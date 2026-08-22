const cron = require('node-cron');
const { lockedJob } = require('../utils/safeJob');
const ClassroomAssignment = require('../models/ClassroomAssignment');
const Task = require('../models/Task');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { sendDigestNotification } = require('../services/notificationEngine');

async function sendDailyDigest() {
  try {
    const users = await User.find({ role: 'student' }).select('_id').lean();

    let sent = 0;
    let deduped = 0;
    let noTokens = 0;
    let errors = 0;
    const errorReasons = new Set();

    for (const u of users) {
      const userId = u._id;

      const pendingAssignments = await ClassroomAssignment.countDocuments({
        userId, status: { $in: ['assigned', 'missing'] },
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      const dueTomorrow = await ClassroomAssignment.countDocuments({
        userId, status: { $in: ['assigned', 'missing'] },
        dueDate: { $lte: tomorrow },
      });

      const todaySessions = await Task.countDocuments({
        user: userId,
        dueDate: {
          $gte: new Date(new Date().toISOString().slice(0, 10)),
          $lte: new Date(new Date().toISOString().slice(0, 10) + 'T23:59:59.999Z'),
        },
      });

      const highestPriority = await ClassroomAssignment.findOne({
        userId, status: { $in: ['assigned', 'missing'] },
        priority: 'CRITICAL',
      }).sort({ dueDate: 1 }).lean();

      const title = '📅 StudentAI Daily Summary';
      const body = [
        `Pending Assignments: ${pendingAssignments}`,
        `Due Tomorrow: ${dueTomorrow}`,
        `Today's Study Sessions: ${todaySessions}`,
        highestPriority ? `Highest Priority: ${highestPriority.title}` : '',
      ].filter(Boolean).join('\n');

      const result = await sendDigestNotification(userId, title, body);
      if (result.success) {
        sent++;
      } else if (result.reason === 'Duplicate within 24h') {
        deduped++;
      } else if (result.reason === 'No tokens') {
        noTokens++;
      } else {
        errors++;
        errorReasons.add(result.error || result.reason);
      }
    }

    const total = sent + deduped + noTokens + errors;
    console.log(`[Digest] Daily digest sent. ${sent} sent, ${deduped} deduped, ${noTokens} no-tokens, ${errors} error${errors !== 1 ? 's' : ''}. Error reasons: ${[...errorReasons].join(', ') || 'none'}`);
  } catch (err) {
    console.error('[DailyDigest]', err.message);
  }
}

async function sendWeeklyDigest() {
  try {
    const users = await User.find({ role: 'student' }).select('_id').lean();

    let sent = 0;
    let deduped = 0;
    let noTokens = 0;
    let errors = 0;
    const errorReasons = new Set();

    const userIds = users.map(u => u._id);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);

    const [atRiskByUser, dueByUser, placementByUser] = await Promise.all([
      Attendance.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $lookup: { from: 'subjects', localField: 'subjectId', foreignField: '_id', as: 'subject' } },
        { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
        { $group: { _id: { userId: '$userId', subjectName: '$subject.name' }, total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } } } },
        { $addFields: { pct: { $multiply: [{ $divide: ['$present', { $max: ['$total', 1] }] }, 100] } } },
        { $match: { pct: { $lt: 75 } } },
      ]).then(rows => {
        const map = new Map();
        for (const row of rows) {
          const uid = row._id.userId.toString();
          if (!map.has(uid)) map.set(uid, []);
          map.get(uid).push({ subject: row._id.subjectName, pct: row.pct });
        }
        return map;
      }),
      ClassroomAssignment.aggregate([
        { $match: { userId: { $in: userIds }, status: { $in: ['assigned', 'missing'] }, dueDate: { $lte: weekEnd } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ]).then(rows => {
        const map = new Map();
        for (const row of rows) map.set(row._id.toString(), row.count);
        return map;
      }),
      Task.aggregate([
        { $match: { user: { $in: userIds }, type: 'placement', dueDate: { $lte: weekEnd } } },
        { $group: { _id: '$user', count: { $sum: 1 } } },
      ]).then(rows => {
        const map = new Map();
        for (const row of rows) map.set(row._id.toString(), row.count);
        return map;
      }),
    ]);

    for (const u of users) {
      const uid = u._id.toString();

      const dueThisWeek = dueByUser.get(uid) || 0;
      const subjectsAtRisk = atRiskByUser.get(uid) || [];
      const placementSessions = placementByUser.get(uid) || 0;

      const title = '🤖 Weekly Academic Plan Ready';
      const body = [
        `Assignments Due This Week: ${dueThisWeek}`,
        `Subjects At Risk: ${subjectsAtRisk.length}`,
        `Placement Sessions Planned: ${placementSessions}`,
        'Tap to view your full roadmap.',
      ].join('\n');

      const result = await sendDigestNotification(u._id, title, body);
      if (result.success) {
        sent++;
      } else if (result.reason === 'Duplicate within 24h') {
        deduped++;
      } else if (result.reason === 'No tokens') {
        noTokens++;
      } else {
        errors++;
        errorReasons.add(result.error || result.reason);
      }
    }

    const total = sent + deduped + noTokens + errors;
    console.log(`[Digest] Weekly digest sent. ${sent} sent, ${deduped} deduped, ${noTokens} no-tokens, ${errors} error${errors !== 1 ? 's' : ''}. Error reasons: ${[...errorReasons].join(', ') || 'none'}`);
  } catch (err) {
    console.error('[WeeklyDigest]', err.message);
  }
}

function startDigestJobs() {
  // Daily at 6 PM
  cron.schedule('0 18 * * *', lockedJob('sendDailyDigest', async () => {
    console.log('[Cron] Sending daily digest...');
    await sendDailyDigest();
  }), { timezone: 'Asia/Kolkata' });

  // Every Sunday at 10 AM
  cron.schedule('0 10 * * 0', lockedJob('sendWeeklyDigest', async () => {
    console.log('[Cron] Sending weekly digest...');
    await sendWeeklyDigest();
  }), { timezone: 'Asia/Kolkata' });

  console.log('[Cron] Digest jobs scheduled.');
}

module.exports = { startDigestJobs, sendDailyDigest, sendWeeklyDigest };
