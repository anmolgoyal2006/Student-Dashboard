const cron                 = require('node-cron');
const { lockedJob }        = require('../utils/safeJob');
const ClassroomAssignment  = require('../models/ClassroomAssignment');
const ClassroomCourse      = require('../models/ClassroomCourse');
const Task                 = require('../models/Task');
const Attendance           = require('../models/Attendance');
const User                 = require('../models/User');
const { sendDigestNotification } = require('../services/notificationEngine');

// ─── IST helpers ────────────────────────────────────────────────────────────

function getISTDateString() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`; // "YYYY-MM-DD"
}

// Start-of-day in IST expressed as a UTC Date object
function istStartOfDay(offsetDays = 0) {
  const istDateStr = getISTDateString();
  // Parse as IST midnight → UTC
  const [y, mo, d] = istDateStr.split('-').map(Number);
  // IST = UTC+5:30, so IST midnight = UTC 18:30 previous day
  const utc = new Date(Date.UTC(y, mo - 1, d + offsetDays, 0, 0, 0) - 5.5 * 60 * 60 * 1000);
  return utc;
}

function istEndOfDay(offsetDays = 0) {
  return new Date(istStartOfDay(offsetDays + 1).getTime() - 1);
}

// ─── Daily digest ────────────────────────────────────────────────────────────

async function sendDailyDigest() {
  try {
    const users = await User.find({ role: 'student' }).select('_id').lean();

    let sent = 0, deduped = 0, noTokens = 0, errors = 0;
    const errorReasons = new Set();

    // IST time boundaries computed once for all users
    const nowUTC       = new Date();
    const todayStart   = istStartOfDay(0);
    const todayEnd     = istEndOfDay(0);
    const tomorrowEnd  = istEndOfDay(1);   // end of tomorrow in IST

    for (const u of users) {
      const userId = u._id;

      // ── Skip users with no synced Classroom courses ───────────────────
      // Sending "Pending: 0, Due Tomorrow: 0" to students who never
      // connected Classroom is just notification spam.
      const hasCourses = await ClassroomCourse.exists({ userId });
      if (!hasCourses) continue;

      // ── Pending assignments (with due date, not yet submitted) ────────
      const pendingAssignments = await ClassroomAssignment.countDocuments({
        userId,
        status : { $in: ['assigned', 'missing'] },
        dueDate: { $ne: null },
      });

      // Skip digest entirely if there is literally nothing to report
      if (pendingAssignments === 0) continue;

      // ── Due tomorrow: due date falls within tomorrow IST ──────────────
      // Using a proper IST window prevents counting overdue assignments
      // or same-day assignments as "due tomorrow".
      const dueTomorrow = await ClassroomAssignment.countDocuments({
        userId,
        status : { $in: ['assigned', 'missing'] },
        dueDate: { $ne: null, $gte: istStartOfDay(1), $lte: tomorrowEnd },
      });

      // ── Today's study sessions (tasks due today in IST) ───────────────
      const todaySessions = await Task.countDocuments({
        user   : userId,
        dueDate: { $gte: todayStart, $lte: todayEnd },
        status : { $ne: 'completed' },
      });

      // ── Most urgent upcoming assignment ───────────────────────────────
      // Prefer CRITICAL, fall back to any soonest-due assignment
      const urgent = await ClassroomAssignment.findOne({
        userId,
        status : { $in: ['assigned', 'missing'] },
        dueDate: { $ne: null, $gte: nowUTC },   // not already overdue
        priority: 'CRITICAL',
      }).sort({ dueDate: 1 }).lean()
        || await ClassroomAssignment.findOne({
          userId,
          status : { $in: ['assigned', 'missing'] },
          dueDate: { $ne: null, $gte: nowUTC },
        }).sort({ dueDate: 1 }).lean();

      const title = '📅 StudentAI Daily Summary';
      const body = [
        `Pending Assignments: ${pendingAssignments}`,
        dueTomorrow > 0 ? `Due Tomorrow: ${dueTomorrow}` : '',
        todaySessions > 0 ? `Today's Study Sessions: ${todaySessions}` : '',
        urgent ? `Urgent: ${urgent.title}` : '',
      ].filter(Boolean).join('\n');

      const result = await sendDigestNotification(userId, title, body);
      if      (result.success)                         sent++;
      else if (result.reason === 'Duplicate within 24h') deduped++;
      else if (result.reason === 'No tokens')            noTokens++;
      else { errors++; errorReasons.add(result.error || result.reason); }
    }

    console.log(`[Digest] Daily: ${sent} sent, ${deduped} deduped, ${noTokens} no-tokens, ${errors} errors. ${errorReasons.size ? [...errorReasons].join(', ') : ''}`);
  } catch (err) {
    console.error('[DailyDigest]', err.message);
  }
}

// ─── Weekly digest ───────────────────────────────────────────────────────────

async function sendWeeklyDigest() {
  try {
    const users = await User.find({ role: 'student' }).select('_id').lean();

    let sent = 0, deduped = 0, noTokens = 0, errors = 0;
    const errorReasons = new Set();

    const userIds = users.map(u => u._id);

    // Week window: start of today IST → end of 7 days from now IST
    const weekStart = istStartOfDay(0);
    const weekEnd   = istEndOfDay(7);

    // ── Batch queries for all users at once ───────────────────────────────

    // 1. At-risk subjects (< 75% attendance), excluding cancelled records
    const atRiskByUser = await Attendance.aggregate([
      { $match: { userId: { $in: userIds }, status: { $ne: 'cancelled' } } },
      { $lookup: {
          from        : 'subjects',
          localField  : 'subjectId',
          foreignField: '_id',
          as          : 'subject',
      }},
      { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
      { $group: {
          _id    : { userId: '$userId', subjectName: '$subject.name' },
          total  : { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
      }},
      { $addFields: {
          pct: { $multiply: [{ $divide: ['$present', { $max: ['$total', 1] }] }, 100] },
      }},
      { $match: { total: { $gt: 0 }, pct: { $lt: 75 } } },
    ]).then(rows => {
      const map = new Map();
      for (const row of rows) {
        const uid = row._id.userId.toString();
        if (!map.has(uid)) map.set(uid, []);
        map.get(uid).push({ subject: row._id.subjectName, pct: Math.round(row.pct) });
      }
      return map;
    });

    // 2. Assignments due this week (with due date, not already submitted)
    const dueByUser = await ClassroomAssignment.aggregate([
      { $match: {
          userId: { $in: userIds },
          status : { $in: ['assigned', 'missing'] },
          dueDate: { $ne: null, $gte: weekStart, $lte: weekEnd },
      }},
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]).then(rows => {
      const map = new Map();
      for (const row of rows) map.set(row._id.toString(), row.count);
      return map;
    });

    // 3. Overdue assignments (dueDate in the past, not submitted)
    const overdueByUser = await ClassroomAssignment.aggregate([
      { $match: {
          userId : { $in: userIds },
          status : { $in: ['assigned', 'missing'] },
          dueDate: { $ne: null, $lt: weekStart },
      }},
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]).then(rows => {
      const map = new Map();
      for (const row of rows) map.set(row._id.toString(), row.count);
      return map;
    });

    for (const u of users) {
      const uid = u._id.toString();

      // ── Skip users with no synced Classroom data ──────────────────────
      const hasCourses = await ClassroomCourse.exists({ userId: u._id });
      if (!hasCourses) continue;

      const dueThisWeek    = dueByUser.get(uid)    || 0;
      const overdue        = overdueByUser.get(uid) || 0;
      const subjectsAtRisk = atRiskByUser.get(uid)  || [];

      // Skip if there is nothing meaningful to report this week
      if (dueThisWeek === 0 && overdue === 0 && subjectsAtRisk.length === 0) continue;

      const title = '🤖 Weekly Academic Plan Ready';
      const body = [
        dueThisWeek > 0    ? `Assignments Due This Week: ${dueThisWeek}` : '',
        overdue > 0        ? `Overdue Assignments: ${overdue}` : '',
        subjectsAtRisk.length > 0
          ? `Subjects At Risk: ${subjectsAtRisk.map(s => `${s.subject} (${s.pct}%)`).join(', ')}`
          : '',
        'Tap to view your full roadmap.',
      ].filter(Boolean).join('\n');

      const result = await sendDigestNotification(u._id, title, body);
      if      (result.success)                           sent++;
      else if (result.reason === 'Duplicate within 24h') deduped++;
      else if (result.reason === 'No tokens')            noTokens++;
      else { errors++; errorReasons.add(result.error || result.reason); }
    }

    console.log(`[Digest] Weekly: ${sent} sent, ${deduped} deduped, ${noTokens} no-tokens, ${errors} errors. ${errorReasons.size ? [...errorReasons].join(', ') : ''}`);
  } catch (err) {
    console.error('[WeeklyDigest]', err.message);
  }
}

// ─── Cron schedule ───────────────────────────────────────────────────────────

function startDigestJobs() {
  // Daily at 8:00 AM IST (Mon–Fri only — no point sending a summary on weekends
  // when most colleges don't have classes)
  cron.schedule('0 8 * * 1-5', lockedJob('sendDailyDigest', async () => {
    console.log('[Cron] Sending daily digest...');
    await sendDailyDigest();
  }), { timezone: 'Asia/Kolkata' });

  // Every Sunday at 9:00 AM IST — week-ahead summary before Monday
  cron.schedule('0 9 * * 0', lockedJob('sendWeeklyDigest', async () => {
    console.log('[Cron] Sending weekly digest...');
    await sendWeeklyDigest();
  }), { timezone: 'Asia/Kolkata' });

  console.log('[Cron] Digest jobs scheduled.');
}

module.exports = { startDigestJobs, sendDailyDigest, sendWeeklyDigest };
