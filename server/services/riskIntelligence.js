const ClassroomAssignment = require('../models/ClassroomAssignment');
const Attendance = require('../models/Attendance');
const { sendNotification } = require('./notificationEngine');
const Notification = require('../models/Notification');

async function checkAcademicRisks(userId) {
  try {
    const assignments = await ClassroomAssignment.find({
      userId,
      status: { $in: ['assigned', 'missing'] },
      dueDate: { $lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
    }).lean();

    if (!assignments.length) return [];

    const Subject = require('../models/Subject');
    const [subjects, records] = await Promise.all([
      Subject.find({ userId }).lean(),
      Attendance.find({ userId }).populate('subjectId', 'name code').lean()
    ]);

    const attendanceMap = {};
    for (const s of subjects) {
      attendanceMap[s.name] = { total: s.initialTotal || 0, present: s.initialPresent || 0 };
    }
    for (const r of records) {
      if (!r.subjectId) continue;
      const name = r.subjectId.name;
      if (!attendanceMap[name]) attendanceMap[name] = { total: 0, present: 0 };
      if (r.status !== 'cancelled') {
        attendanceMap[name].total++;
        if (r.status === 'present') attendanceMap[name].present++;
      }
    }

    const alerts = [];
    for (const a of assignments) {
      const att = attendanceMap[a.courseName];
      if (att && att.total > 0) {
        const pct = (att.present / att.total) * 100;
        if (pct < 75) {
          const alert = {
            subject: a.courseName,
            attendance: Math.round(pct),
            assignment: a.title,
            dueDate: a.dueDate,
            message: `${a.courseName} attendance is ${Math.round(pct)}% — below safe threshold. Assignment due ${new Date(a.dueDate).toLocaleDateString()}. Recommended: Study ${a.courseName} today.`,
          };
          alerts.push(alert);

          await sendNotification(
            userId,
            `⚠️ Academic Risk: ${a.courseName}`,
            alert.message,
            { type: 'RISK_ALERT', subject: a.courseName, assignmentId: a.assignmentId }
          );
        }
      }
    }

    return alerts;
  } catch (err) {
    console.error('[RiskIntelligence]', err.message);
    return [];
  }
}

async function getAcademicRisks(userId) {
  try {
    const thirtyDays = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const notifs = await Notification.find({
      userId,
      type: 'RISK_ALERT',
      createdAt: { $gte: thirtyDays },
    }).sort({ createdAt: -1 }).limit(10).lean();

    return notifs.map(n => ({
      title: n.title,
      message: n.body,
      date: n.createdAt,
    }));
  } catch (err) {
    console.error('[GetAcademicRisks]', err.message);
    return [];
  }
}

module.exports = { checkAcademicRisks, getAcademicRisks };
