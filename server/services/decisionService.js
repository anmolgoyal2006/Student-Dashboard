const Attendance          = require('../models/Attendance');
const Marks               = require('../models/Marks');
const CareerProgress      = require('../models/CareerProgress');
const ClassroomAssignment = require('../models/ClassroomAssignment');

/* ─────────────────────────────────────────────────────────────
   Scoring helpers
───────────────────────────────────────────────────────────── */
const getAttendanceScore = async (userId) => {
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
  const subjects = Object.values(map);
  if (!subjects.length) return { avg: 100, lowSubjects: [] };

  const lowSubjects = subjects
    .map(s => ({ name: s.name, pct: s.total ? +((s.present / s.total) * 100).toFixed(1) : 0 }))
    .filter(s => s.pct < 75);

  const avg = subjects.reduce((acc, s) => {
    return acc + (s.total ? (s.present / s.total) * 100 : 0);
  }, 0) / subjects.length;

  return { avg: +avg.toFixed(1), lowSubjects };
};

const getCGPA = async (userId) => {
  const marks = await Marks.find({ userId, examType: 'final' }).populate('subjectId', 'credits');
  if (!marks.length) return 0;
  let totalWt = 0, totalCr = 0;
  for (const m of marks) {
    const cr = m.subjectId?.credits || 3;
    totalWt += m.gradePoint * cr;
    totalCr += cr;
  }
  return totalCr ? Math.round((totalWt / totalCr + Number.EPSILON) * 100) / 100 : 0;
};

const getCareerData = async (userId) => {
  const career = await CareerProgress.findOne({ userId });
  if (!career) return { problemsSolved: 0, readiness: 'Beginner', targetCompany: 'Other', lcEasy: 0, lcMedium: 0, lcHard: 0, lcLinked: false };
  const lc = career.leetcodeSync || {};
  return {
    problemsSolved: career.problemsSolved || 0,
    readiness:      career.readiness || 'Beginner',
    targetCompany:  career.targetCompany || 'Other',
    lcEasy:         lc.easy || 0,
    lcMedium:       lc.medium || 0,
    lcHard:         lc.hard || 0,
    lcLinked:       !!career.leetcodeUsername,
  };
};

const getClassroomAssignments = async (userId) => {
  const assignments = await ClassroomAssignment.find({ userId, status: { $ne: 'submitted' } }).sort({ dueDate: 1 }).limit(5);
  return assignments.map(a => ({
    title: a.title,
    course: a.courseName,
    dueDate: a.dueDate,
    status: a.status,
    priority: a.priority,
  }));
};

/* ─────────────────────────────────────────────────────────────
   Risk level calculation
   Score 0–100: higher = more at risk
───────────────────────────────────────────────────────────── */
const calcRiskLevel = ({ attendanceAvg, cgpa, problemsSolved, lcMedium, lcHard, lcLinked, overdueAssignments }) => {
  let score = 0;
  if (attendanceAvg < 65)      score += 40;
  else if (attendanceAvg < 75) score += 25;
  else if (attendanceAvg < 85) score += 10;

  if (cgpa > 0) {
    if (cgpa < 5)      score += 35;
    else if (cgpa < 7) score += 20;
    else if (cgpa < 8) score += 8;
  }

  if (problemsSolved < 30)       score += 15;
  else if (problemsSolved < 100) score += 8;

  if (lcLinked) {
    if (lcMedium < 30)  score += 10;
    if (lcHard < 5)     score += 5;
  } else {
    if (problemsSolved > 0) score += 5;
  }

  if (overdueAssignments > 0) score += overdueAssignments * 8;

  if (score >= 50) return 'High';
  if (score >= 25) return 'Medium';
  return 'Low';
};

/* ─────────────────────────────────────────────────────────────
   Plan generation
───────────────────────────────────────────────────────────── */
const generatePlan = ({ attendanceAvg, lowSubjects, cgpa, career, riskLevel, classroomAssignments }) => {
  const actions = [];

  // Priority 1 — attendance warnings
  for (const s of lowSubjects.slice(0, 2)) {
    const needed = Math.ceil((0.75 * (s.pct > 0 ? 100 / s.pct : 1) - 1) / 0.25);
    actions.push({
      priority: 'high',
      icon:     '⚠️',
      action:   `Attend ${s.name} classes`,
      reason:   `Attendance is ${s.pct}% — below 75% threshold`,
      tag:      'Attendance',
    });
  }

  // Priority 2 — classroom assignments due soon
  const urgentAssignment = classroomAssignments.find(a => {
    if (!a.dueDate) return false;
    const due = new Date(a.dueDate);
    const now = new Date();
    const diff = (due - now) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
  });
  if (urgentAssignment) {
    const due = new Date(urgentAssignment.dueDate);
    const label = `Due ${due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    actions.push({
      priority: 'high',
      icon:     '📋',
      action:   `Complete "${urgentAssignment.title}"`,
      reason:   `${urgentAssignment.course} assignment ${label}`,
      tag:      'Classroom',
    });
  }

  // Priority 3 — CGPA
  if (actions.length < 3 && cgpa > 0 && cgpa < 7) {
    actions.push({
      priority: 'high',
      icon:     '📚',
      action:   'Revise weak subjects today',
      reason:   `CGPA is ${cgpa} — focus on improving exam performance`,
      tag:      'Academics',
    });
  }

  // Priority 4 — DSA / career (with LeetCode difficulty awareness)
  if (actions.length < 3) {
    if (career.lcLinked && career.lcMedium < 20) {
      actions.push({
        priority: 'medium',
        icon:     '💻',
        action:   'Solve 2 medium LeetCode problems',
        reason:   `Only ${career.lcMedium} medium solved — focus on medium-level DSA`,
        tag:      'Career',
      });
    } else if (career.problemsSolved < 50) {
      actions.push({
        priority: 'medium',
        icon:     '💻',
        action:   'Solve 3 DSA problems',
        reason:   `Only ${career.problemsSolved} problems solved — start with Arrays & Strings`,
        tag:      'Career',
      });
    } else if (career.problemsSolved < 150) {
      actions.push({
        priority: 'medium',
        icon:     '🚀',
        action:   `Practice ${career.targetCompany} interview patterns`,
        reason:   `${career.problemsSolved} problems done — push to 150+ for placements`,
        tag:      'Career',
      });
    }
  }

  // Priority 5 — general study if all good
  if (actions.length === 0) {
    actions.push({
      priority: 'low',
      icon:     '🎯',
      action:   'Review upcoming exam topics',
      reason:   'Attendance and CGPA look healthy — stay ahead',
      tag:      'Academics',
    });
    actions.push({
      priority: 'low',
      icon:     '💡',
      action:   'Complete one mock interview',
      reason:   `${career.readiness} readiness — keep building momentum`,
      tag:      'Career',
    });
  }

  // Always cap at top 3
  return actions.slice(0, 3);
};

/* ─────────────────────────────────────────────────────────────
   Main export
───────────────────────────────────────────────────────────── */
exports.getTodayPlan = async (userId) => {
  const [{ avg: attendanceAvg, lowSubjects }, cgpa, career, classroomAssignments] = await Promise.all([
    getAttendanceScore(userId),
    getCGPA(userId),
    getCareerData(userId),
    getClassroomAssignments(userId),
  ]);

  const overdueCount = classroomAssignments.filter(a => a.dueDate && new Date(a.dueDate) < new Date()).length;

  const riskLevel  = calcRiskLevel({
    attendanceAvg,
    cgpa,
    problemsSolved: career.problemsSolved,
    lcMedium: career.lcMedium,
    lcHard: career.lcHard,
    lcLinked: career.lcLinked,
    overdueAssignments: overdueCount,
  });
  const todayPlan  = generatePlan({ attendanceAvg, lowSubjects, cgpa, career, riskLevel, classroomAssignments });
  const focusArea  = lowSubjects.length > 0 || (cgpa > 0 && cgpa < 7) ? 'Academics' : 'Career';

  return { todayPlan, riskLevel, focusArea };
};