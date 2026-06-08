const Attendance          = require('../models/Attendance');
const Marks               = require('../models/Marks');
const CareerProgress      = require('../models/CareerProgress');
const Subject             = require('../models/Subject');
const Task                = require('../models/Task');
const ClassroomAssignment = require('../models/ClassroomAssignment');
const Groq                = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_CHAT_KEY || process.env.GROQ_API_KEY });

const COMPANY_ROADMAPS = {
  Amazon: [
    'Master Arrays, Trees, DP (LeetCode top 100)',
    'Study all 16 Amazon Leadership Principles — prepare 2 stories each',
    'Practice System Design: URL shortener, Parking Lot, Amazon Cart',
    'Do 5+ mock interviews on Pramp or Interviewing.io',
  ],
  Microsoft: [
    'Strong grip on DSA + Object-Oriented Design',
    'Study Design Patterns (Singleton, Factory, Observer)',
    'Practice behavioral questions (Growth Mindset focus)',
    'Learn Azure basics — AZ-900 level understanding',
  ],
  Google: [
    'Advanced DSA — master Graphs, DP, Segment Trees',
    'Large-scale System Design (distributed systems concepts)',
    'Mathematics: Probability, Combinatorics, Number Theory',
    'Code quality — write clean, testable, well-named code in every interview',
  ],
  Flipkart: [
    'DSA focus — Arrays, Trees, DP (same as product companies)',
    'System Design: E-commerce scale (product catalog, cart, orders)',
    'Study Flipkart tech blogs and engineering challenges',
  ],
  Adobe: [
    'DSA medium-hard level (LeetCode)',
    'Creative problem solving — data structures for media',
    'OOPs and Design Patterns are heavily tested',
    'Behavioral: focus on collaboration and creativity stories',
  ],
  Infosys: [
    'Focus on fundamentals: Arrays, Strings, Sorting',
    'Strong aptitude + verbal reasoning preparation',
    'Learn at least one framework (React, Spring Boot)',
    'Practice HR round questions',
  ],
  TCS: [
    'Aptitude preparation (TCS NQT pattern)',
    'Basic DSA + Programming in C/C++/Java/Python',
    'Communication and soft skills round prep',
  ],
  Other: [
    'Solve 150+ LeetCode problems across all topics',
    'Learn System Design basics',
    'Build 2-3 strong projects for your resume',
    'Practice mock interviews regularly',
  ],
};

// ── Traditional Rule-Based Fallback Suggestions ──────────────────────────────
const getAttendanceSuggestions = async (userId) => {
  const records = await Attendance.find({ userId }).populate('subjectId', 'name');
  const map = {};
  for (const r of records) {
    if (!r.subjectId) continue;
    const key = r.subjectId._id.toString();
    if (!map[key]) map[key] = { name: r.subjectId.name, total: 0, present: 0 };
    if (r.status !== 'cancelled') {
      map[key].total++;
      if (r.status === 'present') map[key].present++;
    }
  }
  const suggestions = [];
  for (const s of Object.values(map)) {
    if (!s.total) continue;
    const pct = (s.present / s.total) * 100;
    if (pct < 75) {
      const needed = Math.ceil((0.75 * s.total - s.present) / 0.25);
      suggestions.push({
        type:     'warning',
        priority: 'high',
        icon:     '⚠️',
        title:    `Low Attendance: ${s.name}`,
        message:  `Your attendance is ${pct.toFixed(1)}%. You need to attend ${needed} more consecutive classes to reach 75%.`,
      });
    }
  }
  return suggestions;
};

const getCGPASuggestions = async (userId) => {
  const marks = await Marks.find({ userId, examType: 'final' }).populate('subjectId', 'name credits');
  if (!marks.length) return [];

  let totalWt = 0, totalCr = 0;
  const weak = [];
  for (const m of marks) {
    const cr = m.subjectId?.credits || 3;
    totalWt += m.gradePoint * cr;
    totalCr += cr;
    if (m.gradePoint <= 6) weak.push(m.subjectId?.name || 'Unknown');
  }
  const cgpa = totalCr ? totalWt / totalCr : 0;
  const suggestions = [];

  if (cgpa > 0 && cgpa < 6.0) {
    suggestions.push({
      type:     'study',
      priority: 'high',
      icon:     '📚',
      title:    'CGPA Needs Attention',
      message:  `Current CGPA: ${cgpa.toFixed(2)}. Focus on theory revision and practice papers for: ${weak.join(', ')}.`,
    });
  } else if (cgpa >= 6 && cgpa < 7.5) {
    suggestions.push({
      type:     'study',
      priority: 'medium',
      icon:     '📖',
      title:    'Improve CGPA',
      message:  `CGPA is ${cgpa.toFixed(2)}. Improving weak subjects (${weak.join(', ')}) could push you above 8.`,
    });
  }
  return suggestions;
};

const getCareerSuggestions = async (userId) => {
  const career = await CareerProgress.findOne({ userId });
  if (!career) return [];

  const suggestions = [];
  const { problemsSolved, targetCompany, dsaTopics, readiness } = career;
  const lc = career.leetcodeSync || {};

  if (career.leetcodeUsername && (lc.easy > 30 && lc.medium < 20)) {
    suggestions.push({
      type:     'dsa',
      priority: 'medium',
      icon:     '💡',
      title:    'Focus on Medium Problems',
      message:  `You've solved ${lc.easy} Easy but only ${lc.medium} Medium. Level up to medium difficulty for interview readiness.`,
    });
  } else if (career.leetcodeUsername && (lc.easy + lc.medium > 50 && lc.hard < 5)) {
    suggestions.push({
      type:     'dsa',
      priority: 'medium',
      icon:     '🔥',
      title:    'Start Hard Problems',
      message:  `Only ${lc.hard} Hard problems solved. Top companies ask Hard — start practicing.`,
    });
  } else if (!career.leetcodeUsername && problemsSolved > 0) {
    suggestions.push({
      type:     'dsa',
      priority: 'info',
      icon:     '🔗',
      title:    'Link LeetCode Account',
      message:  `You've solved ${problemsSolved} problems. Link your LeetCode profile for detailed tracking.`,
    });
  }

  if (problemsSolved < 50) {
    const incomplete = dsaTopics.filter(t => !t.completed).slice(0, 3).map(t => t.name);
    suggestions.push({
      type:     'dsa',
      priority: 'high',
      icon:     '💻',
      title:    'Start DSA Practice',
      message:  `Only ${problemsSolved} problems solved. Begin with: ${incomplete.join(', ')}. Target 150+ for placements.`,
    });
  } else if (problemsSolved < 150) {
    suggestions.push({
      type:     'dsa',
      priority: 'medium',
      icon:     '💡',
      title:    'Keep Going with DSA',
      message:  `${problemsSolved} problems done — good progress! Push to 150+ and tackle Hard problems on LeetCode.`,
    });
  }

  const roadmap = COMPANY_ROADMAPS[targetCompany] || COMPANY_ROADMAPS.Other;
  suggestions.push({
    type:     'career',
    priority: 'medium',
    icon:     '🎯',
    title:    `${targetCompany} Preparation Roadmap`,
    message:  roadmap.join(' → '),
  });

  suggestions.push({
    type:     'readiness',
    priority: 'info',
    icon:     readiness === 'Ready' ? '🏆' : readiness === 'Intermediate' ? '🔥' : '🌱',
    title:    'Placement Readiness',
    message:  `You are currently at: ${readiness} level. ${
      readiness === 'Beginner'     ? 'Focus on DSA fundamentals and improve CGPA.' :
      readiness === 'Intermediate' ? 'Start mock interviews and System Design.' :
                                     'You are placement ready! Practice HR rounds and final mock interviews.'
    }`,
    value: readiness,
  });

  return suggestions;
};

const getClassroomSuggestions = async (userId) => {
  const assignments = await ClassroomAssignment.find({ userId, status: { $ne: 'submitted' } }).sort({ dueDate: 1 }).limit(5);
  const suggestions = [];
  const now = new Date();

  for (const a of assignments) {
    if (!a.dueDate) continue;
    const diff = (new Date(a.dueDate) - now) / (1000 * 60 * 60 * 24);
    if (diff < 0) {
      suggestions.push({
        type:     'warning',
        priority: 'high',
        icon:     '⚠️',
        title:    `Overdue: ${a.title}`,
        message:  `${a.courseName} assignment was due! Submit ASAP.`,
      });
    } else if (diff <= 3) {
      suggestions.push({
        type:     'study',
        priority: 'high',
        icon:     '📋',
        title:    `Due Soon: ${a.title}`,
        message:  `${a.courseName} due in ${Math.ceil(diff)} day(s). Start working on it.`,
      });
    }
  }

  return suggestions;
};

// Fallback logic aggregator
async function getFallbackRecommendations(userId) {
  const [attendanceSuggestions, cgpaSuggestions, careerSuggestions, classroomSuggestions] = await Promise.all([
    getAttendanceSuggestions(userId),
    getCGPASuggestions(userId),
    getCareerSuggestions(userId),
    getClassroomSuggestions(userId),
  ]);
  const all = [...attendanceSuggestions, ...cgpaSuggestions, ...careerSuggestions, ...classroomSuggestions];
  const order = { high: 0, medium: 1, info: 2 };
  all.sort((a, b) => order[a.priority] - order[b.priority]);
  return all;
}

// Helper to safely extract JSON array from Groq output
function extractJSONArray(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { /* fall through */ }
  const match = raw.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* fall through */ }
  }
  return null;
}

// ── Main Recommendation Exporter (Calls Groq, falls back to Rules) ───────────
exports.getRecommendations = async (userId) => {
  try {
    // 1. Gather all student datasets from Database
    const [subjects, attendanceRecords, marksRecords, pendingTasks, careerProgress, classroomAssignments] = await Promise.all([
      Subject.find({ userId }),
      Attendance.find({ userId }).populate('subjectId', 'name'),
      Marks.find({ userId }).populate('subjectId', 'name'),
      Task.find({ user: userId, status: { $ne: 'completed' } }),
      CareerProgress.findOne({ userId }),
      ClassroomAssignment.find({ userId, status: { $ne: 'submitted' } }).sort({ dueDate: 1 }).limit(10),
    ]);

    // Format Attendance Summary
    const attMap = {};
    attendanceRecords.forEach(r => {
      if (!r.subjectId) return;
      const name = r.subjectId.name;
      if (!attMap[name]) attMap[name] = { total: 0, present: 0 };
      if (r.status !== 'cancelled') {
        attMap[name].total++;
        if (r.status === 'present') attMap[name].present++;
      }
    });
    const attendanceSummary = Object.entries(attMap).map(([name, data]) => {
      const pct = data.total ? (data.present / data.total * 100).toFixed(1) : 0;
      return `${name}: ${pct}% (${data.present}/${data.total} classes)`;
    });

    // Format Marks Summary
    const marksSummary = marksRecords.map(m => {
      const pct = ((m.marksObtained / m.maxMarks) * 100).toFixed(1);
      return `${m.subjectId?.name || 'Unknown'} — ${m.examType}: ${m.marksObtained}/${m.maxMarks} (${pct}%) [Grade Point: ${m.gradePoint}]`;
    });

    // Format Tasks Summary
    const tasksSummary = pendingTasks.map(t => {
      const due = t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : 'None';
      return `• [${t.priority.toUpperCase()}] ${t.title} (due ${due}) - subject: ${t.subject || 'General'}`;
    });

    // Format LeetCode Data
    let leetcodeSummary = "Not linked.";
    if (careerProgress && careerProgress.leetcodeUsername) {
      const lc = careerProgress.leetcodeSync || {};
      const topTopics = Object.entries(lc.topicCounts || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([t, c]) => `${t}: ${c}`)
        .join(', ');
      leetcodeSummary = `Username: ${careerProgress.leetcodeUsername}, Total: ${lc.totalOnLeetcode || 0}, Easy: ${lc.easy || 0}, Medium: ${lc.medium || 0}, Hard: ${lc.hard || 0}, Top Topics: ${topTopics || 'none'}`;
    }

    // Format Classroom Assignments
    const assignmentsSummary = classroomAssignments.map(a => {
      const due = a.dueDate ? new Date(a.dueDate).toISOString().slice(0, 10) : 'No due date';
      return `• [${a.priority}] ${a.title} — ${a.courseName} (due ${due}, status: ${a.status})`;
    });

    // Format Career Progress
    let careerSummary = "No placement profile set yet.";
    if (careerProgress) {
      const incompleteTopics = careerProgress.dsaTopics.filter(t => !t.completed).map(t => t.name).slice(0, 3).join(', ');
      careerSummary = `Target Company: ${careerProgress.targetCompany}, Problems Solved: ${careerProgress.problemsSolved}, Placement Readiness: ${careerProgress.readiness}, Incomplete DSA Topics: ${incompleteTopics}`;
    }

    // Build the payload
    const studentData = {
      subjectsCount: subjects.length,
      attendance: attendanceSummary,
      examMarks: marksSummary,
      pendingTasks: tasksSummary,
      careerProfile: careerSummary,
      leetcode: leetcodeSummary,
      classroomAssignments: assignmentsSummary,
    };

    const systemPrompt = `
You are an advanced, intelligent Academic & Placement Advisor for a Student Dashboard app.
Given the student's current database statistics, analyze their status and output exactly 3 to 4 personalized, highly specific, and actionable recommendations.

YOUR ENTIRE OUTPUT MUST BE A RAW JSON ARRAY. NO EXPLANATIONS, NO MARKDOWN CODE FENCES, NO EXTRA TEXT.

Output format should be exactly this JSON structure:
[
  {
    "type": "warning" | "study" | "dsa" | "career" | "readiness",
    "priority": "high" | "medium" | "info",
    "icon": "emoji",
    "title": "short title (max 5 words)",
    "message": "highly specific actionable advice tailored to the data (max 20 words)"
  }
]

Critical Analysis Rules:
1. If any subject's attendance is under 75%, add a "warning" item with high priority. Mention the subject and tell them they need to attend classes.
2. If the student has low exam marks (e.g. under 60% or Grade Point <= 6) in any subject, add a "study" recommendation. Mention the subject.
3. If they have outstanding tasks near deadlines, recommend working on them.
4. If they have linked LeetCode, analyze their difficulty breakdown: if Easy is high but Medium is low, recommend focusing on Medium problems. If Hard is very low or zero, recommend starting Hard problems. Mention specific topic gaps from the Top Topics data.
5. If they have not linked LeetCode but have problems solved in their career profile, recommend linking LeetCode for better tracking.
6. If they have classroom assignments due within the next 3 days, add a "warning" or "study" item to complete them. Mention the assignment title and course name.
7. If they have multiple submitted/returned classroom assignments pending grade review, suggest following up.
8. If their overall DSA/career progress is strong (150+ problems, high readiness), suggest advanced topics like System Design or mock interviews.
9. Reference actual names of subjects, exam types, task titles, target companies, LeetCode stats, and classroom assignment titles from the data. Do not make up mock data.
`;

    // 2. Call Groq
    console.log('[AI Recommendation] Requesting Groq...');
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(studentData) }
      ],
      temperature: 0.2,
      max_tokens: 600,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    console.log('[AI Recommendation Raw]:', raw);

    const parsed = extractJSONArray(raw);
    if (parsed && Array.isArray(parsed) && parsed.length > 0) {
      console.log('[AI Recommendation] Groq suggestions parsed successfully.');
      return parsed;
    } else {
      console.warn('[AI Recommendation] Unparseable Groq output. Falling back to rule-based suggestions.');
    }

  } catch (err) {
    console.error('[AI Recommendation] Groq error:', err.message);
  }

  // Fallback if Groq fails or errors out
  console.log('[AI Recommendation] Using rule-based fallback recommendations.');
  return getFallbackRecommendations(userId);
};
