const cron = require('node-cron');
const { safeJob } = require('../utils/safeJob');
const ClassroomAssignment = require('../models/ClassroomAssignment');
const Task = require('../models/Task');
const { sendAssignmentNotification, sendSessionNotification, sendNotification } = require('../services/notificationEngine');
const { checkAcademicRisks } = require('../services/riskIntelligence');

// Check upcoming deadlines every hour
async function checkDeadlines() {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in6h = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    const assignments = await ClassroomAssignment.find({
      status: { $in: ['assigned', 'missing'] },
      dueDate: { $ne: null },
    }).lean();

    let sent = 0;
    let deduped = 0;
    let noTokens = 0;
    let errors = 0;
    const errorReasons = new Set();

    for (const a of assignments) {
      if (!a.userId || !a.dueDate) continue;
      const dueTime = new Date(a.dueDate).getTime();

      // Due in ~6 hours
      if (dueTime > now.getTime() && dueTime < in6h.getTime()) {
        const result = await sendAssignmentNotification(a, a.userId);
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
      // Due in ~24 hours (mutually exclusive with 6h window)
      else if (dueTime >= in6h.getTime() && dueTime < in24h.getTime()) {
        const result = await sendAssignmentNotification(a, a.userId);
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
    }

    const total = sent + deduped + noTokens + errors;
    console.log(`[CheckDeadlines] ${sent} sent, ${deduped} deduped, ${noTokens} no-tokens, ${errors} error${errors !== 1 ? 's' : ''}. Error reasons: ${[...errorReasons].join(', ') || 'none'}`);
  } catch (err) {
    console.error('[CheckDeadlines]', err.message);
  }
}

// Check upcoming study sessions every 15 minutes
async function checkSessions() {
  try {
    const now = new Date();
    const in15min = new Date(now.getTime() + 15 * 60 * 1000);

    const tasks = await Task.find({
      status: { $ne: 'completed' },
      dueDate: {
        $gte: new Date(now.getTime() - 60 * 1000),
        $lte: new Date(in15min.getTime() + 60 * 1000),
      },
    }).lean();

    let sent = 0;
    let deduped = 0;
    let noTokens = 0;
    let errors = 0;
    const errorReasons = new Set();

    for (const t of tasks) {
      if (!t.user) continue;
      const taskTime = new Date(t.dueDate).getTime();

      if (taskTime > now.getTime() && taskTime < in15min.getTime()) {
        const result = await sendSessionNotification(t, t.user, 15); // tasks in next 15 min → SESSION_SOON
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
    }

    const total = sent + deduped + noTokens + errors;
    console.log(`[CheckSessions] ${sent} sent, ${deduped} deduped, ${noTokens} no-tokens, ${errors} error${errors !== 1 ? 's' : ''}. Error reasons: ${[...errorReasons].join(', ') || 'none'}`);
  } catch (err) {
    console.error('[CheckSessions]', err.message);
  }
}

// Run risk intelligence
async function checkRisks() {
  try {
    const User = require('../models/User');
    const users = await User.find({ role: 'student' }).select('_id').lean();

    // Run in parallel with a concurrency limit of 10 so we don't hammer the DB
    const CONCURRENCY = 10;
    for (let i = 0; i < users.length; i += CONCURRENCY) {
      await Promise.all(
        users.slice(i, i + CONCURRENCY).map(u => checkAcademicRisks(u._id).catch(err =>
          console.error(`[CheckRisks] user ${u._id}:`, err.message)
        ))
      );
    }
  } catch (err) {
    console.error('[CheckRisks]', err.message);
  }
}

function startNotificationJobs() {
  // Every hour
  cron.schedule('0 * * * *', safeJob('checkDeadlines+checkRisks', async () => {
    console.log('[Cron] Checking deadlines...');
    await checkDeadlines();
    await checkRisks();
  }), { timezone: 'Asia/Kolkata' });

  // Every 15 minutes
  cron.schedule('*/15 * * * *', safeJob('checkSessions', async () => {
    console.log('[Cron] Checking sessions...');
    await checkSessions();
  }), { timezone: 'Asia/Kolkata' });

  console.log('[Cron] Notification jobs scheduled.');
}

module.exports = { startNotificationJobs, checkDeadlines, checkSessions, checkRisks };
