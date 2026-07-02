const Semester = require('../models/Semester.model');
const Attendance = require('../models/Attendance');
const Marks = require('../models/Marks');
const CareerProgress = require('../models/CareerProgress');
const Subject = require('../models/Subject');
const Task = require('../models/Task');
const { chatCompletionsCreate, HEAVY_MODEL } = require('../services/aiService');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const DEFAULT_CREDIT_PATTERN = [22, 21, 22, 24, 20, 12, 19, 21];

/**
 * Computes a weighted recent trend from the last `window` semesters.
 */
function computeWeightedTrend(sgpas, window = 3) {
  if (sgpas.length < 2) return 0;

  const recent = sgpas.slice(-Math.min(window, sgpas.length));
  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 1; i < recent.length; i++) {
    const weight     = i;
    weightedSum     += (recent[i] - recent[i - 1]) * weight;
    totalWeight     += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

function clamp(value, min = 0, max = 10) {
  return Math.min(max, Math.max(min, value));
}

/**
 * GET /predict
 *
 * Query params:
 *   currentCGPA       — manual current CGPA override (optional)
 *   completed         — manual completed semesters count (optional)
 *   targetCGPA        — target CGPA to reach (optional)
 *   totalSemesters    — total semesters in the degree
 *   totalDegreeCredits — total course credits (default 161)
 */
exports.getPredict = async (req, res) => {
  try {
    const { currentCGPA: manualCGPA, completed: manualCompleted, targetCGPA, totalSemesters, totalDegreeCredits, semesterCredits: rawSemCredits } = req.query;
    const target     = parseFloat(targetCGPA);
    const total      = parseInt(totalSemesters, 10) || 8;

    // ── 1. Fetch DB semesters first if not in manual mode ─────────────────────
    let semesters = [];
    if (!manualCGPA) {
      semesters = await Semester.find({ student: req.user.id }).sort({ semesterNumber: 1 });
    }
    const completed = manualCGPA ? (parseInt(manualCompleted, 10) || 0) : semesters.length;

    // Extract actual database credits
    const dbCredits = semesters.map(s => {
      if (s.isManual) return s.totalCredits || 20;
      return (s.subjects || []).reduce((sum, sub) => sum + sub.credits, 0) || 20;
    });

    // ── 2. Build per-semester credit distribution ──────────────────────────
    let adjustedCredits = rawSemCredits
      ? rawSemCredits.split(',').map(s => parseInt(s, 10) || 20).slice(0, total)
      : (() => {
          const p = DEFAULT_CREDIT_PATTERN.slice(0, total);
          while (p.length < total) p.push(DEFAULT_CREDIT_PATTERN[DEFAULT_CREDIT_PATTERN.length - 1]);
          return p;
        })();
    while (adjustedCredits.length < total) adjustedCredits.push(20);
    adjustedCredits = adjustedCredits.slice(0, total);

    // Merge actual database credits for completed semesters
    if (!manualCGPA) {
      for (let i = 0; i < completed; i++) {
        if (i < dbCredits.length) {
          adjustedCredits[i] = dbCredits[i];
        }
      }
    }

    const sumCredits = adjustedCredits.reduce((a, b) => a + b, 0);

    // ── 3. Determine current CGPA and completed count ──────────────────────
    let currentCGPA, sgpaList, currentWeightedSum;

    if (manualCGPA) {
      currentCGPA = clamp(parseFloat(manualCGPA), 0, 10);
      sgpaList    = [];
      currentWeightedSum = currentCGPA * adjustedCredits.slice(0, completed).reduce((a, b) => a + b, 0);
    } else {
      sgpaList  = semesters.map(s => s.sgpa);

      if (completed === 0 && isNaN(target)) {
        return res.json({
          sgpaList:    [],
          futureSGPAs: [],
          currentCGPA: null,
          predictedCGPA: null,
          requiredSGPA: null,
          creditBreakdown: adjustedCredits,
          completed: 0,
          remaining: total,
          message: 'No semester data found. Enter your Current CGPA manually above.',
        });
      }

      if (completed === 0) {
        currentWeightedSum = 0;
        currentCGPA = null;
      } else {
        const completedCredits = adjustedCredits.slice(0, completed);
        currentWeightedSum = sgpaList.reduce((sum, sgpa, i) => {
          const cr = i < completedCredits.length ? completedCredits[i] : 0;
          return sum + sgpa * cr;
        }, 0);
        const totalCompletedCredits = completedCredits.reduce((a, b) => a + b, 0);
        currentCGPA = totalCompletedCredits > 0
          ? round2(currentWeightedSum / totalCompletedCredits)
          : round2(sgpaList.reduce((a, b) => a + b, 0) / completed);
      }
    }

    const remaining = Math.max(total - completed, 0);

    // ── 4. Required SGPA to hit target ────────────────────────────────────
    let requiredSGPA = null;
    let targetInsight = null;

    if (!isNaN(target) && remaining > 0) {
      const futureCredits = adjustedCredits.slice(completed).reduce((a, b) => a + b, 0);

      if (futureCredits > 0) {
        const raw = (target * sumCredits - currentWeightedSum) / futureCredits;
        requiredSGPA = round2(clamp(raw));

        if (raw > 10) {
          targetInsight = `Target CGPA ${target} is not achievable — it would require an average of ${raw.toFixed(2)} per semester.`;
        } else if (raw < 0) {
          targetInsight = `You have already surpassed your target CGPA of ${target}.`;
        } else {
          targetInsight = `You need an average of ${requiredSGPA} per remaining semester to reach CGPA ${target}.`;
        }
      }
    }

    // ── 5. Future SGPA prediction ─────────────────────────────────────────
    let futureSGPAs = [];
    let predictedCGPA = currentCGPA;

    if (remaining > 0) {
      if (sgpaList.length > 0) {
        const recentTrend = computeWeightedTrend(sgpaList);
        const lastSGPA    = sgpaList[sgpaList.length - 1];
        const AVERAGE_WEIGHT = 0.30;
        const TREND_WEIGHT   = 0.70;
        const DAMP_FACTOR    = 0.65;

        futureSGPAs = Array.from({ length: remaining }, (_, i) => {
          const dampedTrend = recentTrend * Math.pow(DAMP_FACTOR, i + 1);
          const trendBased  = lastSGPA + dampedTrend;
          const blended     = (AVERAGE_WEIGHT * (currentCGPA || 0)) + (TREND_WEIGHT * trendBased);
          return round2(clamp(blended));
        });
      } else {
        // If manual CGPA override is used, or a fresh student with no SGPA list
        const defaultFutureSGPA = currentCGPA || 8.0;
        futureSGPAs = Array(remaining).fill(round2(clamp(defaultFutureSGPA)));
      }

      // Credit-weighted predicted CGPA
      let futureWeightedSum = 0;
      if (futureSGPAs.length > 0) {
        futureWeightedSum = futureSGPAs.reduce((sum, sgpa, idx) => {
          const cr = adjustedCredits[completed + idx] || 20;
          return sum + sgpa * cr;
        }, 0);
      }
      predictedCGPA = round2((currentWeightedSum + futureWeightedSum) / sumCredits);
    }

    // ── 6. Response ───────────────────────────────────────────────────────
    const recentTrend = sgpaList.length > 0 ? computeWeightedTrend(sgpaList) : 0;
    const trendLabel =
      recentTrend > 0.2  ? 'improving 📈' :
      recentTrend < -0.2 ? 'declining 📉' :
                           'stable ➡️';

    res.json({
      sgpaList,
      futureSGPAs,
      currentCGPA,
      predictedCGPA,
      requiredSGPA,
      completed,
      remaining,
      creditBreakdown: adjustedCredits,
      insights: {
        recentTrend  : round2(recentTrend),
        performance  : trendLabel,
        targetInsight: targetInsight ?? 'Set a target CGPA to see goal analysis.',
      },
    });

  } catch (err) {
    console.error('[getPredict] Error:', err.message);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

function distributeRequiredSGPA(requiredSGPA, remaining, completed, adjustedCredits) {
  if (remaining <= 0) return [];
  if (remaining === 1) {
    return [{ semester: completed + 1, suggestedSGPA: requiredSGPA }];
  }

  let offsets = [];
  if (remaining === 2) {
    offsets = [-0.15, 0.15];
  } else if (remaining === 3) {
    offsets = [-0.20, 0.0, 0.20];
  } else if (remaining === 4) {
    offsets = [-0.25, -0.05, 0.10, 0.20];
  } else {
    for (let i = 0; i < remaining; i++) {
      offsets.push(-0.30 + (0.60 * i) / (remaining - 1));
    }
  }

  const futureCredits = adjustedCredits.slice(completed);
  const sumFutureCredits = futureCredits.reduce((a, b) => a + b, 0);

  let sumWeightedOffsets = 0;
  for (let i = 0; i < remaining; i++) {
    sumWeightedOffsets += offsets[i] * (futureCredits[i] || 20);
  }
  const delta = sumFutureCredits > 0 ? -sumWeightedOffsets / sumFutureCredits : 0;

  const roadmap = [];
  for (let i = 0; i < remaining; i++) {
    const val = requiredSGPA + offsets[i] + delta;
    const clampedVal = Math.min(10, Math.max(0, Math.round(val * 100) / 100));
    roadmap.push({
      semester: completed + i + 1,
      suggestedSGPA: clampedVal
    });
  }

  return roadmap;
}

exports.getAIAnalysis = async (req, res) => {
  try {
    const { currentCGPA: manualCGPA, completed: manualCompleted, targetCGPA, totalSemesters, totalDegreeCredits, semesterCredits: rawSemCredits } = req.query;
    const target = parseFloat(targetCGPA);
    const total = parseInt(totalSemesters, 10) || 8;

    let semesters = [];
    if (!manualCGPA) {
      semesters = await Semester.find({ student: req.user.id }).sort({ semesterNumber: 1 });
    }
    const completed = manualCGPA ? (parseInt(manualCompleted, 10) || 0) : semesters.length;

    const dbCredits = semesters.map(s => {
      if (s.isManual) return s.totalCredits || 20;
      return (s.subjects || []).reduce((sum, sub) => sum + sub.credits, 0) || 20;
    });

    let adjustedCredits = rawSemCredits
      ? rawSemCredits.split(',').map(s => parseInt(s, 10) || 20).slice(0, total)
      : [22, 21, 22, 24, 20, 12, 19, 21];
    while (adjustedCredits.length < total) adjustedCredits.push(20);
    adjustedCredits = adjustedCredits.slice(0, total);

    if (!manualCGPA) {
      for (let i = 0; i < completed; i++) {
        if (i < dbCredits.length) {
          adjustedCredits[i] = dbCredits[i];
        }
      }
    }

    const sumCredits = adjustedCredits.reduce((a, b) => a + b, 0);

    let currentCGPA, sgpaList, currentWeightedSum;
    if (manualCGPA) {
      currentCGPA = clamp(parseFloat(manualCGPA), 0, 10);
      sgpaList = [];
      currentWeightedSum = currentCGPA * adjustedCredits.slice(0, completed).reduce((a, b) => a + b, 0);
    } else {
      sgpaList = semesters.map(s => s.sgpa);
      if (completed === 0) {
        currentWeightedSum = 0;
        currentCGPA = 0;
      } else {
        const completedCredits = adjustedCredits.slice(0, completed);
        currentWeightedSum = sgpaList.reduce((sum, sgpa, i) => {
          const cr = i < completedCredits.length ? completedCredits[i] : 0;
          return sum + sgpa * cr;
        }, 0);
        const totalCompletedCredits = completedCredits.reduce((a, b) => a + b, 0);
        currentCGPA = totalCompletedCredits > 0
          ? round2(currentWeightedSum / totalCompletedCredits)
          : round2(sgpaList.reduce((a, b) => a + b, 0) / completed);
      }
    }

    const remaining = Math.max(total - completed, 0);

    let requiredSGPA = null;
    if (!isNaN(target) && remaining > 0) {
      const futureCredits = adjustedCredits.slice(completed).reduce((a, b) => a + b, 0);
      if (futureCredits > 0) {
        const raw = (target * sumCredits - currentWeightedSum) / futureCredits;
        requiredSGPA = round2(clamp(raw, 0, 10));
      }
    }

    const [subjects, attendanceRecords, marksRecords, pendingTasks, careerProgress] = await Promise.all([
      Subject.find({ userId: req.user.id }),
      Attendance.find({ userId: req.user.id }).populate('subjectId', 'name'),
      Marks.find({ userId: req.user.id }).populate('subjectId', 'name'),
      Task.find({ user: req.user.id, status: { $ne: 'completed' } }),
      CareerProgress.findOne({ userId: req.user.id }),
    ]);

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
    const lowAttendance = [];
    Object.entries(attMap).forEach(([name, data]) => {
      const pct = data.total ? (data.present / data.total * 100) : 0;
      if (pct < 75) {
        lowAttendance.push({ subject: name, attendance: `${pct.toFixed(1)}%` });
      }
    });

    const lowGrades = [];
    marksRecords.forEach(m => {
      const pct = m.maxMarks ? (m.marksObtained / m.maxMarks * 100) : 0;
      if (m.gradePoint <= 6 || pct < 60) {
        lowGrades.push({
          subject: m.subjectId?.name || 'Unknown',
          exam: m.examType,
          score: `${m.marksObtained}/${m.maxMarks}`,
          gradePoint: m.gradePoint
        });
      }
    });

    const tasks = pendingTasks.map(t => ({
      title: t.title,
      subject: t.subject || 'General',
      priority: t.priority,
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : 'None'
    })).slice(0, 5);

    let career = null;
    if (careerProgress) {
      career = {
        targetCompany: careerProgress.targetCompany,
        solvedProblems: careerProgress.problemsSolved,
        readiness: careerProgress.readiness
      };
    }

    if (isNaN(target)) {
      return res.json({
        feasibility: 'Medium',
        feasibilityReason: 'Specify a Target CGPA above to analyze trajectory feasibility.',
        analysis: `You have completed ${completed} semesters with a cumulative CGPA of ${currentCGPA || '—'}. To start your StudentAI planning and generate custom semester-by-semester SGPA target roadmaps, enter a Target CGPA and click Calculate.`,
        bottlenecks: [
          ...lowAttendance.map(la => ({
            subject: la.subject,
            issue: `Attendance is low at ${la.attendance}.`,
            impact: 'Potential risk of losing internal assessment marks.'
          })),
          ...lowGrades.map(lg => ({
            subject: lg.subject,
            issue: `Grade point is ${lg.gradePoint} in ${lg.exam} (${lg.score}).`,
            impact: 'Negatively impacts cumulative CGPA.'
          }))
        ].slice(0, 3),
        roadmap: [],
        strategies: [
          'Set a Target CGPA in the calculator above and click Calculate to run a custom strategic roadmap.',
          'Focus heavily on courses with higher credit weights to optimize your future GPA shifts.',
          'Keep class attendance above 75% across all active subjects to remain eligible for exams.'
        ]
      });
    }

    let roadmapTargets = [];
    if (remaining > 0) {
      if (!isNaN(target)) {
        const futureCredits = adjustedCredits.slice(completed).reduce((a, b) => a + b, 0);
        if (futureCredits > 0) {
          const raw = (target * sumCredits - currentWeightedSum) / futureCredits;
          const baselineSGPA = raw > 10 ? 9.8 : clamp(raw, 0, 10);
          roadmapTargets = distributeRequiredSGPA(baselineSGPA, remaining, completed, adjustedCredits);
        }
      } else {
        const lastSGPA = sgpaList.length > 0 ? sgpaList[sgpaList.length - 1] : 8.5;
        const baselineSGPA = clamp(lastSGPA, 5.0, 10);
        roadmapTargets = distributeRequiredSGPA(baselineSGPA, remaining, completed, adjustedCredits);
      }
    }

    const analysisPayload = {
      completedSemesters: completed,
      remainingSemesters: remaining,
      currentCGPA,
      targetCGPA: isNaN(target) ? 'None' : target,
      requiredSGPA: requiredSGPA ?? 'None',
      suggestedRoadmap: roadmapTargets,
      creditDistribution: adjustedCredits,
      subjectsCount: subjects.length,
      lowAttendanceSubjects: lowAttendance,
      weakGrades: lowGrades,
      pendingTasks: tasks,
      careerProfile: career
    };

    const getFallbackAIResponse = () => {
      let feasibility = 'Medium';
      let reason = 'Based on mathematical projection of required SGPAs.';
      if (requiredSGPA === null) {
        feasibility = 'High';
        reason = 'No target CGPA specified to calculate feasibility.';
      } else if (requiredSGPA > 10) {
        feasibility = 'Impossible';
        reason = `Required average SGPA of ${requiredSGPA} exceeds the maximum scale of 10.0.`;
      } else if (requiredSGPA > 9.0) {
        feasibility = 'Low';
        reason = `Requires maintaining a very high SGPA of ${requiredSGPA} in all remaining semesters.`;
      } else if (requiredSGPA > 8.0) {
        feasibility = 'Challenging';
        reason = `Requires achieving an average SGPA of ${requiredSGPA} which is higher than current CGPA.`;
      } else if (requiredSGPA > 5.0) {
        feasibility = 'High';
        reason = `Required SGPA is ${requiredSGPA}, which is highly achievable based on average performance.`;
      }

      const calculatedRoadmap = [];
      for (let i = 1; i <= remaining; i++) {
        calculatedRoadmap.push({
          semester: completed + i,
          suggestedSGPA: requiredSGPA !== null ? requiredSGPA : 8.0,
          focus: `Focus on core subjects in Semester ${completed + i}.`
        });
      }

      const calculatedBottlenecks = [];
      lowAttendance.forEach(la => {
        calculatedBottlenecks.push({
          subject: la.subject,
          issue: `Attendance is low at ${la.attendance}.`,
          impact: 'Risk of failing eligibility or losing internal marks.'
        });
      });
      lowGrades.slice(0, 2).forEach(lg => {
        calculatedBottlenecks.push({
          subject: lg.subject,
          issue: `Low marks in ${lg.exam}: ${lg.score} (Grade Point: ${lg.gradePoint}).`,
          impact: 'Negatively impacts cumulative CGPA.'
        });
      });

      return {
        feasibility,
        feasibilityReason: reason,
        analysis: `You have completed ${completed} semesters with a CGPA of ${currentCGPA || '—'}. To reach your target of ${target || '—'}, you need to optimize your study habits across the remaining ${remaining} semesters.`,
        bottlenecks: calculatedBottlenecks.slice(0, 3),
        roadmap: calculatedRoadmap,
        strategies: [
          'Prioritize subjects with higher credits to maximize CGPA weight.',
          'Attend classes consistently to ensure attendance remains above the 75% threshold.',
          'Solve DSA problems and complete pending tasks to prepare for upcoming evaluations.'
        ]
      };
    };

    const systemPrompt = `
You are StudentAI, an elite academic and placement strategist. Your job is to analyze a student's CGPA trajectory, target goals, weak grades, low attendance, outstanding tasks, and placement target.
Provide a highly specific, customized strategy and roadmap.

YOUR ENTIRE OUTPUT MUST BE A RAW JSON OBJECT. NO EXPLANATIONS, NO MARKDOWN CODE FENCES (e.g. do NOT wrap in \`\`\`json), NO EXTRA TEXT.

Output format should be exactly this JSON structure:
{
  "feasibility": "High" | "Medium" | "Challenging" | "Low" | "Impossible",
  "feasibilityReason": "A concise explanation of target feasibility considering current CGPA, remaining semesters, and required SGPA (max 25 words)",
  "analysis": "A realistic 2-3 sentence overview of their academic health, trends, and what needs to change to hit their goal.",
  "bottlenecks": [
    {
      "subject": "Name of Subject",
      "issue": "Specific issue from attendance/grades (e.g., Attendance is 62% OR Midterm marks are 18/50)",
      "impact": "Concrete impact on grades/eligibility (max 12 words)"
    }
  ],
  "roadmap": [
    {
      "semester": 5,
      "suggestedSGPA": 9.2,
      "focus": "Specific focus recommendation (e.g. Focus on high-credit core subjects or project work, max 10 words)"
    }
  ],
  "strategies": [
    "Highly specific actionable advice based on the student's data. Avoid generic tips. Mention actual subjects, companies, or tasks. (max 20 words each)"
  ]
}

Instructions:
1. Feasibility:
   - "Impossible" if requiredSGPA > 10.
   - "Low" if requiredSGPA is very high (e.g., > 9.2) and recent performance is significantly lower.
   - "Challenging" if requiredSGPA is between 8.2 and 9.2.
   - "High" / "Medium" if requiredSGPA is realistic (< 8.2).
   - In "feasibilityReason", refer to the EXACT number of remaining semesters from the payload (remainingSemesters key). Do NOT confuse remaining semesters with total semesters or completed semesters.
2. Roadmap:
   - The roadmap array MUST contain exactly the same number of entries as 'suggestedRoadmap' in the payload.
   - For each entry, you MUST use the exact 'semester' and 'suggestedSGPA' values provided in the payload's 'suggestedRoadmap' array. Do NOT modify or deviate from these numerical suggestedSGPA values or hallucinate different SGPAs.
   - For each semester entry, add a highly contextual academic 'focus' string (max 10 words).
3. Bottlenecks:
   - Extract up to 3 bottlenecks. Prioritize low attendance (< 75%) and weak grades (Grade Point <= 6). Reference subject names exactly.
4. Strategies:
   - Tailor specifically to the student's company target (e.g., Amazon leadership principles, LeetCode progress) and pending tasks.
`;

    console.log('[AI Predictor Analysis] Requesting Gemini...');
    let parsedResult = null;
    try {
      const completion = await chatCompletionsCreate({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(analysisPayload) }
        ],
        model: HEAVY_MODEL,
        temperature: 0.3,
        max_tokens: 1000,
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? '';
      console.log('[AI Predictor Analysis Raw Response]:', raw);

      let cleaned = raw;
      if (cleaned.startsWith('```')) {
        const lines = cleaned.split('\n');
        if (lines[0].startsWith('```')) lines.shift();
        if (lines[lines.length - 1].startsWith('```')) lines.pop();
        cleaned = lines.join('\n').trim();
      }

      parsedResult = JSON.parse(cleaned);
      console.log('[AI Predictor Analysis] Successfully parsed response.');
    } catch (aiErr) {
      console.error('[AI Predictor Analysis] Gemini API call or JSON parsing failed:', aiErr.message);
    }

    if (parsedResult && parsedResult.feasibility) {
      return res.json(parsedResult);
    } else {
      console.log('[AI Predictor Analysis] Using fallback rule-based analysis.');
      return res.json(getFallbackAIResponse());
    }

  } catch (err) {
    console.error('[getAIAnalysis] Major Error:', err.message);
    res.status(500).json({ message: 'Something went wrong while generating AI Analysis. Please try again.' });
  }
};
