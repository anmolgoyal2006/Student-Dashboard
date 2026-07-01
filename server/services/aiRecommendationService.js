const Attendance          = require('../models/Attendance');
const Marks               = require('../models/Marks');
const CareerProgress      = require('../models/CareerProgress');
const Subject             = require('../models/Subject');
const Task                = require('../models/Task');
const ClassroomAssignment = require('../models/ClassroomAssignment');
const { chatCompletionsCreate } = require('./aiService');

const COMPANY_ROADMAPS = {
  Amazon:   ['Master Arrays, Trees, DP (LeetCode top 100)', 'Study all 16 Amazon Leadership Principles — prepare 2 stories each', 'Practice System Design: URL shortener, Parking Lot, Amazon Cart', 'Do 5+ mock interviews on Pramp or Interviewing.io'],
  Microsoft:['Strong grip on DSA + Object-Oriented Design', 'Study Design Patterns (Singleton, Factory, Observer)', 'Practice behavioral questions (Growth Mindset focus)', 'Learn Azure basics — AZ-900 level understanding'],
  Google:   ['Advanced DSA — master Graphs, DP, Segment Trees', 'Large-scale System Design (distributed systems concepts)', 'Mathematics: Probability, Combinatorics, Number Theory', 'Code quality — write clean, testable, well-named code in every interview'],
  Flipkart: ['DSA focus — Arrays, Trees, DP (same as product companies)', 'System Design: E-commerce scale (product catalog, cart, orders)', 'Study Flipkart tech blogs and engineering challenges'],
  Adobe:    ['DSA medium-hard level (LeetCode)', 'Creative problem solving — data structures for media', 'OOPs and Design Patterns are heavily tested', 'Behavioral: focus on collaboration and creativity stories'],
  Infosys:  ['Focus on fundamentals: Arrays, Strings, Sorting', 'Strong aptitude + verbal reasoning preparation', 'Learn at least one framework (React, Spring Boot)', 'Practice HR round questions'],
  TCS:      ['Aptitude preparation (TCS NQT pattern)', 'Basic DSA + Programming in C/C++/Java/Python', 'Communication and soft skills round prep'],
  Other:    ['Solve 150+ LeetCode problems across all topics', 'Learn System Design basics', 'Build 2-3 strong projects for your resume', 'Practice mock interviews regularly'],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractJSONArray(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { /* fall through */ }
  const match = raw.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* fall through */ } }
  return null;
}

function daysFromNow(date) {
  return (new Date(date) - new Date()) / (1000 * 60 * 60 * 24);
}

// ── Data Formatters ───────────────────────────────────────────────────────────

function formatAttendance(records) {
  const map = {};
  for (const r of records) {
    if (!r.subjectId) continue;
    const name = r.subjectId.name;
    if (!map[name]) map[name] = { total: 0, present: 0 };
    if (r.status !== 'cancelled') {
      map[name].total++;
      if (r.status === 'present') map[name].present++;
    }
  }
  // Only include subjects that have actual classes
  return Object.entries(map)
    .filter(([, d]) => d.total > 0)
    .map(([name, d]) => {
      const pct = ((d.present / d.total) * 100).toFixed(1);
      const needed = pct < 75
        ? Math.ceil((0.75 * d.total - d.present) / 0.25)
        : 0;
      return {
        subject: name,
        percentage: parseFloat(pct),
        present: d.present,
        total: d.total,
        atRisk: pct < 75,
        classesNeeded: needed,
        summary: `${name}: ${pct}% (${d.present}/${d.total})${needed > 0 ? ` — needs ${needed} more classes` : ''}`,
      };
    });
}

function formatMarks(records) {
  // Group by subject, keep latest per exam type
  const map = {};
  for (const m of records) {
    const name = m.subjectId?.name || 'Unknown';
    if (!map[name]) map[name] = [];
    const pct = m.maxMarks > 0 ? ((m.marksObtained / m.maxMarks) * 100).toFixed(1) : 0;
    map[name].push({
      examType: m.examType,
      percentage: parseFloat(pct),
      summary: `${name} [${m.examType}]: ${m.marksObtained}/${m.maxMarks} (${pct}%)`,
    });
  }
  return Object.entries(map).map(([subject, exams]) => ({
    subject,
    exams,
    avgPercentage: (exams.reduce((s, e) => s + e.percentage, 0) / exams.length).toFixed(1),
    weak: exams.some(e => e.percentage < 60),
  }));
}

const PAST_TO_IMPERATIVE = [
  [/^Solved\s+/i,    'Solve '],
  [/^Completed\s+/i, 'Complete '],
  [/^Attended\s+/i,  'Attend '],
  [/^Finished\s+/i,  'Finish '],
  [/^Submitted\s+/i, 'Submit '],
  [/^Practiced\s+/i, 'Practice '],
  [/^Reviewed\s+/i,  'Review '],
  [/^Watched\s+/i,   'Watch '],
  [/^Read\s+/i,      'Read '],
  [/^Wrote\s+/i,     'Write '],
];

function toImperative(title) {
  for (const [pattern, replacement] of PAST_TO_IMPERATIVE) {
    if (pattern.test(title)) return title.replace(pattern, replacement);
  }
  return title;
}

function formatTasks(tasks) {
  return tasks.map(t => {
    const due = t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : 'No date';
    const diff = t.dueDate ? daysFromNow(t.dueDate) : null;
    const cleanTitle = toImperative(t.title);
    return {
      title:        cleanTitle,
      priority:     t.priority,
      subject:      t.subject || 'General',
      daysUntilDue: diff !== null ? Math.ceil(diff) : null,
      overdue:      diff !== null && diff < 0,
      dueSoon:      diff !== null && diff >= 0 && diff <= 3,
      summary:      `[${t.priority.toUpperCase()}] ${cleanTitle} — due ${due} (subject: ${t.subject || 'General'})`,
    };
  });
}

function formatLeetCode(career) {
  if (!career || !career.leetcodeUsername) return { linked: false, summary: 'Not linked.' };
  const lc = career.leetcodeSync || {};
  const total = lc.totalOnLeetcode || 0;
  const easy  = lc.easy   || 0;
  const medium= lc.medium || 0;
  const hard  = lc.hard   || 0;

  // Top weak topics (least solved)
  const topicEntries = Object.entries(lc.topicCounts || {}).sort((a, b) => a[1] - b[1]);
  const weakTopics   = topicEntries.slice(0, 3).map(([t, c]) => `${t}(${c})`).join(', ');
  const strongTopics = topicEntries.slice(-3).reverse().map(([t, c]) => `${t}(${c})`).join(', ');

  // Diagnose problem distribution — computed server-side with guaranteed correct numbers
  const diagnosis = [];
  if (total < 50) {
    diagnosis.push('Very early stage — focus on Easy/Medium basics');
  } else if (total >= 50 && total < 150) {
    diagnosis.push('Intermediate — push Medium problems hard');
  } else {
    diagnosis.push('Strong base — tackle Hard + System Design');
  }
  if (easy > 0 && easy > 2 * medium) {
    diagnosis.push(`Too many Easy solves (${easy} Easy vs ${medium} Medium) — shift to Medium`);
  }
  if (total >= 80 && hard < 10) {
    diagnosis.push(`Only ${hard} Hard solved — start attempting Hard problems weekly`);
  }
  if (medium >= easy * 1.5) {
    diagnosis.push(`Good Medium volume (${medium} Medium) — maintain with targeted Hard on weak topics`);
  }

  return {
    linked: true,
    username: career.leetcodeUsername,
    total, easy, medium, hard,
    weakTopics,
    strongTopics,
    diagnosis: diagnosis.join('; '),
    summary: `User: ${career.leetcodeUsername} | Total: ${total} (Easy:${easy}, Medium:${medium}, Hard:${hard}) | Weak topics: ${weakTopics || 'none'} | Strong: ${strongTopics || 'none'} | ${diagnosis.join('; ')}`,
  };
}

function formatClassroomAssignments(assignments) {
  return assignments.map(a => {
    const diff = a.dueDate ? daysFromNow(a.dueDate) : null;
    const due  = a.dueDate ? new Date(a.dueDate).toISOString().slice(0, 10) : 'No date';
    return {
      title:      a.title,
      course:     a.courseName,
      status:     a.status,
      daysUntilDue: diff !== null ? Math.ceil(diff) : null,
      overdue:    diff !== null && diff < 0,
      dueSoon:    diff !== null && diff >= 0 && diff <= 3,
      summary:    `${a.title} (${a.courseName}) — due ${due}, ${diff !== null ? (diff < 0 ? `OVERDUE by ${Math.abs(Math.ceil(diff))}d` : `${Math.ceil(diff)}d left`) : 'no date'}`,
    };
  });
}

function formatCareer(career) {
  if (!career) return { exists: false, summary: 'No placement profile set.' };
  const incomplete = career.dsaTopics.filter(t => !t.completed).map(t => t.name);
  const complete   = career.dsaTopics.filter(t =>  t.completed).map(t => t.name);
  return {
    exists:          true,
    targetCompany:   career.targetCompany,
    problemsSolved:  career.problemsSolved,
    readiness:       career.readiness,
    incompleteTopics: incomplete.slice(0, 5),
    completeTopics:   complete,
    roadmap:         COMPANY_ROADMAPS[career.targetCompany] || COMPANY_ROADMAPS.Other,
    summary: `Target: ${career.targetCompany} | Solved: ${career.problemsSolved} | Readiness: ${career.readiness} | Incomplete DSA: ${incomplete.slice(0, 5).join(', ') || 'none'} | Completed: ${complete.slice(0, 3).join(', ') || 'none'}`,
  };
}

// ── Rule-Based Fallback ───────────────────────────────────────────────────────

async function getFallbackRecommendations(userId) {
  const [attendanceRecords, marksRecords, tasks, career, classroomAssignments] = await Promise.all([
    Attendance.find({ userId }).populate('subjectId', 'name'),
    Marks.find({ userId, examType: 'final' }).populate('subjectId', 'name credits'),
    Task.find({ user: userId, status: { $ne: 'completed' } }),
    CareerProgress.findOne({ userId }),
    ClassroomAssignment.find({ userId, status: { $ne: 'submitted' } }).sort({ dueDate: 1 }).limit(5),
  ]);

  const suggestions = [];

  // Attendance
  const attData = formatAttendance(attendanceRecords);
  for (const s of attData.filter(a => a.atRisk)) {
    suggestions.push({ type: 'warning', priority: 'high', icon: '⚠️', title: `Low Attendance: ${s.subject}`, message: `${s.percentage}% attendance. Attend ${s.classesNeeded} more classes to reach 75%.` });
  }

  // Marks
  const marksData = formatMarks(marksRecords);
  let totalWt = 0, totalCr = 0;
  for (const m of marksRecords) {
    const cr = m.subjectId?.credits || 3;
    totalWt += (m.gradePoint || 0) * cr;
    totalCr += cr;
  }
  const cgpa = totalCr ? (totalWt / totalCr).toFixed(2) : null;
  const weakSubjects = marksData.filter(m => m.weak).map(m => m.subject);
  if (cgpa && parseFloat(cgpa) < 7.5 && weakSubjects.length) {
    suggestions.push({ type: 'study', priority: cgpa < 6 ? 'high' : 'medium', icon: '📚', title: 'Revise Weak Subjects', message: `CGPA ${cgpa}. Improve: ${weakSubjects.slice(0, 3).join(', ')}.` });
  }

  // Classroom
  const classData = formatClassroomAssignments(classroomAssignments);
  for (const a of classData) {
    if (a.overdue)       suggestions.push({ type: 'warning', priority: 'high',   icon: '⚠️', title: `Overdue: ${a.title}`, message: `${a.course} — submit immediately.` });
    else if (a.dueSoon)  suggestions.push({ type: 'study',   priority: 'high',   icon: '📋', title: `Due Soon: ${a.title}`, message: `${a.course} due in ${a.daysUntilDue} day(s).` });
  }

  // Tasks
  const taskData = formatTasks(tasks);
  const urgentTasks = taskData.filter(t => t.overdue || t.dueSoon);
  if (urgentTasks.length) {
    suggestions.push({ type: 'study', priority: 'high', icon: '📝', title: 'Urgent Tasks', message: urgentTasks.slice(0, 3).map(t => t.title).join(', ') + ' — complete now.' });
  }

  // Career / LeetCode
  if (career) {
    const lc = formatLeetCode(career);
    if (!lc.linked && career.problemsSolved > 0) {
      suggestions.push({ type: 'dsa', priority: 'info', icon: '🔗', title: 'Link LeetCode', message: 'Connect LeetCode to track detailed progress.' });
    } else if (lc.linked) {
      if (lc.easy > 30 && lc.medium < 20) suggestions.push({ type: 'dsa', priority: 'medium', icon: '💡', title: 'Solve More Mediums', message: `${lc.easy} Easy but only ${lc.medium} Medium. Level up difficulty.` });
      else if (lc.total > 50 && lc.hard < 5) suggestions.push({ type: 'dsa', priority: 'medium', icon: '🔥', title: 'Start Hard Problems', message: `Only ${lc.hard} Hard solved. Top companies require Hard-level.` });
    }
    if (career.problemsSolved < 50) suggestions.push({ type: 'dsa', priority: 'high', icon: '💻', title: 'Start DSA Practice', message: `${career.problemsSolved} problems done. Target 150+ for placements.` });
    suggestions.push({ type: 'readiness', priority: 'info', icon: career.readiness === 'Ready' ? '🏆' : career.readiness === 'Intermediate' ? '🔥' : '🌱', title: 'Placement Readiness', message: `${career.readiness} level. ${career.readiness === 'Ready' ? 'Practice HR & mock interviews.' : career.readiness === 'Intermediate' ? 'Start System Design prep.' : 'Focus on DSA fundamentals.'}`, value: career.readiness });
  }

  const order = { high: 0, medium: 1, info: 2 };
  suggestions.sort((a, b) => order[a.priority] - order[b.priority]);
  return suggestions.slice(0, 6);
}

// ── Main Export ───────────────────────────────────────────────────────────────

exports.getRecommendations = async (userId) => {
  try {
    const [subjects, attendanceRecords, marksRecords, pendingTasks, career, classroomAssignments] = await Promise.all([
      Subject.find({ userId }),
      Attendance.find({ userId }).populate('subjectId', 'name'),
      Marks.find({ userId }).populate('subjectId', 'name'),
      Task.find({ user: userId, status: { $ne: 'completed' } }),
      CareerProgress.findOne({ userId }),
      ClassroomAssignment.find({ userId, status: { $ne: 'submitted' } }).sort({ dueDate: 1 }).limit(10),
    ]);

    // Format all data with rich context
    const attData         = formatAttendance(attendanceRecords);
    const marksData       = formatMarks(marksRecords);
    const taskData        = formatTasks(pendingTasks);
    const lcData          = formatLeetCode(career);
    const classData       = formatClassroomAssignments(classroomAssignments);
    const careerData      = formatCareer(career);

    // Compute CGPA
    let totalWt = 0, totalCr = 0;
    for (const m of marksRecords) {
      const cr = m.subjectId?.credits || 3;
      totalWt += (m.gradePoint || 0) * cr;
      totalCr += cr;
    }
    const cgpa = totalCr ? (totalWt / totalCr).toFixed(2) : 'N/A';

    const studentData = {
      totalSubjects:   subjects.length,
      cgpa,

      // Rich attendance with at-risk flags
      attendance: attData.map(a => a.summary),
      atRiskSubjects: attData.filter(a => a.atRisk).map(a => `${a.subject} (${a.percentage}%, needs ${a.classesNeeded} more classes)`),

      // Marks with weak subject flags
      examMarks:    marksData.flatMap(m => m.exams.map(e => e.summary)),
      weakSubjects: marksData.filter(m => m.weak).map(m => m.subject),

      // Tasks with urgency context
      pendingTasks: taskData.map(t => t.summary),
      overdueTasks: taskData.filter(t => t.overdue).map(t => t.title),
      dueSoonTasks: taskData.filter(t => t.dueSoon).map(t => `${t.title} (${t.daysUntilDue}d)`),

      // Classroom with urgency
      classroomAssignments: classData.map(a => a.summary),
      overdueAssignments:   classData.filter(a => a.overdue).map(a => `${a.title} (${a.course})`),
      dueSoonAssignments:   classData.filter(a => a.dueSoon).map(a => `${a.title} — ${a.course} in ${a.daysUntilDue}d`),

      // Career & LeetCode
      careerProfile: careerData.summary,
      leetcode:      lcData.summary,
      leetcodeDiagnosis: lcData.diagnosis || '',
      targetCompany: careerData.targetCompany || 'Not set',
      placementReadiness: careerData.readiness || 'Unknown',
      companyRoadmap: careerData.roadmap ? careerData.roadmap.join(' | ') : '',
    };

    const systemPrompt = `
You are a precise Academic & Placement Advisor AI for a Student Dashboard.
Analyze the student data below and return EXACTLY 4 to 6 personalized, actionable recommendations.

YOUR ENTIRE OUTPUT MUST BE A RAW JSON ARRAY. NO MARKDOWN, NO EXPLANATIONS, NO CODE FENCES.

Output format:
[
  {
    "type": "warning" | "study" | "dsa" | "career" | "readiness" | "classroom",
    "priority": "high" | "medium" | "info",
    "icon": "single emoji",
    "title": "max 6 words",
    "message": "specific, actionable advice in max 20 words"
  }
]

STRICT RULES — follow exactly:

ATTENDANCE:
- If atRiskSubjects list is non-empty → MUST include a "warning" high-priority card per at-risk subject
- Title: "Attend [Subject]" | Message: "X% attendance. Need N more classes for 75%."
- SKIP subjects with 0 total classes

MARKS/CGPA:
- If weakSubjects non-empty → "study" card. Title: "Revise [Subject]"
- Mention percentage only, NEVER mention gradePoint or grade point
- If cgpa < 6 → high priority. If 6–7.5 → medium.

CLASSROOM ASSIGNMENTS:
- overdueAssignments → "warning" high: "Submit [title] for [course] immediately."
- dueSoonAssignments → "classroom" high: "Complete [title] for [course] — due in Xd."

TASKS:
- overdueTasks or dueSoonTasks → "study" high/medium card listing them
- Rephrase past-tense task titles to imperative form

LEETCODE (only if linked):
- Use the pre-computed leetcodeDiagnosis field for all difficulty advice — it is accurate
- If leetcodeDiagnosis mentions "Too many Easy solves" -> "study" card: "Solve more Medium problems"
- If leetcodeDiagnosis mentions "Hard solved" -> "study" card about attempting Hard problems
- NEVER suggest linking LeetCode if username is already present
- Do NOT recompute ratios or counts — trust the provided numbers exactly

CAREER:
- Always include 1 "career" card with target company roadmap next step
- If readiness = Ready → suggest mock interviews & HR prep
- If Intermediate → suggest System Design
- If Beginner → suggest DSA fundamentals

GENERAL:
- Use exact names from the data, never invent data
- No duplicate recommendations
- Prioritize: overdue > due soon > at-risk attendance > weak marks > DSA > career
- Return between 4 and 6 items total
`;

    console.log('[AI Recommendation] Requesting Gemini...');
    const completion = await chatCompletionsCreate({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: JSON.stringify(studentData, null, 2) },
      ],
      temperature: 0.15,
      max_tokens:  2048,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    console.log('[AI Recommendation Raw]:', raw);

    const parsed = extractJSONArray(raw);
    if (parsed && Array.isArray(parsed) && parsed.length > 0) {
      console.log('[AI Recommendation] Gemini parsed successfully:', parsed.length, 'items');

      const lcLinked = career && !!career.leetcodeUsername;

      const filtered = parsed.filter(r => {
        // Remove "link LeetCode" if already linked
        if (lcLinked && (r.title?.toLowerCase().includes('link leetcode') || r.message?.toLowerCase().includes('link your leetcode'))) return false;
        // Remove 0% attendance suggestions (no real classes)
        if (r.message?.includes('0%') && r.title?.toLowerCase().startsWith('attend')) return false;
        // Remove any gradePoint mentions
        if (r.message?.toLowerCase().includes('gradepoint') || r.message?.toLowerCase().includes('grade point')) return false;
        return true;
      });

      // Deduplicate by title
      const seen = new Set();
      const deduped = filtered.filter(r => {
        const key = r.title?.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return deduped.length > 0 ? deduped : parsed;
    }

    console.warn('[AI Recommendation] Unparseable output — falling back to rule-based.');

  } catch (err) {
    console.error('[AI Recommendation] Gemini error:', err.message);
  }

  console.log('[AI Recommendation] Using rule-based fallback.');
  return getFallbackRecommendations(userId);
};
