const Attendance = require('../models/Attendance');

const PRIORITY_LEVELS = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

function basePriority(dueDate) {
  if (!dueDate) return 'LOW';
  const now = new Date();
  const diffMs = new Date(dueDate).getTime() - now.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);

  if (diffHrs < 24) return 'CRITICAL';
  if (diffHrs < 72) return 'HIGH';
  if (diffHrs < 168) return 'MEDIUM';
  return 'LOW';
}

async function calculatePriority(assignment, userId) {
  let priority = basePriority(assignment.dueDate);
  let boostCount = 0;

  const subjectName = assignment.courseName || '';

  if (subjectName) {
    const records = await Attendance.find({ userId })
      .populate('subjectId', 'name');
    const subjectRecords = records.filter(r =>
      r.subjectId && r.subjectId.name.toLowerCase() === subjectName.toLowerCase()
    );
    const total = subjectRecords.filter(r => r.status !== 'cancelled').length;
    const present = subjectRecords.filter(r => r.status === 'present').length;
    const pct = total > 0 ? (present / total) * 100 : 100;

    if (pct < 75) boostCount++;

    if (assignment.points >= 80) boostCount++;
  }

  const pendingSame = await require('../models/ClassroomAssignment').countDocuments({
    userId,
    courseName: subjectName,
    status: { $in: ['assigned', 'missing'] },
  });
  if (pendingSame >= 3) boostCount++;

  const idx = PRIORITY_LEVELS[priority];
  const boosted = Math.min(idx + boostCount, 3);
  const map = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  return map[boosted];
}

module.exports = { calculatePriority, basePriority };
