const Attendance     = require('../models/Attendance');
const Marks          = require('../models/Marks');
const CareerProgress = require('../models/CareerProgress');

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
  return totalCr ? +(totalWt / totalCr).toFixed(2) : 0;
};

const getCareerData = async (userId) => {
  const career = await CareerProgress.findOne({ userId });
  if (!career) return { problemsSolved: 0, readiness: 'Beginner', targetCompany: 'Other' };
  return {
    problemsSolved: career.problemsSolved || 0,
    readiness:      career.readiness || 'Beginner',
    targetCompany:  career.targetCompany || 'Other',
  };
};

/* ─────────────────────────────────────────────────────────────
   Risk level calculation
   Score 0–100: higher = more at risk
───────────────────────────────────────────────────────────── */
const calcRiskLevel = ({ attendanceAvg, cgpa, problemsSolved }) => {
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

  if (score >= 50) return 'High';
  if (score >= 25) return 'Medium';
  return 'Low';
};

/* ─────────────────────────────────────────────────────────────
   Plan generation
───────────────────────────────────────────────────────────── */
const generatePlan = ({ attendanceAvg, lowSubjects, cgpa, career, riskLevel }) => {
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

  // Priority 2 — CGPA
  if (cgpa > 0 && cgpa < 7) {
    actions.push({
      priority: 'high',
      icon:     '📚',
      action:   'Revise weak subjects today',
      reason:   `CGPA is ${cgpa} — focus on improving exam performance`,
      tag:      'Academics',
    });
  }

  // Priority 3 — DSA / career
  if (career.problemsSolved < 50) {
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

  // Priority 4 — general study if all good
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
  const [{ avg: attendanceAvg, lowSubjects }, cgpa, career] = await Promise.all([
    getAttendanceScore(userId),
    getCGPA(userId),
    getCareerData(userId),
  ]);

  const riskLevel  = calcRiskLevel({ attendanceAvg, cgpa, problemsSolved: career.problemsSolved });
  const todayPlan  = generatePlan({ attendanceAvg, lowSubjects, cgpa, career, riskLevel });
  const focusArea  = lowSubjects.length > 0 || (cgpa > 0 && cgpa < 7) ? 'Academics' : 'Career';

  return { todayPlan, riskLevel, focusArea };
};