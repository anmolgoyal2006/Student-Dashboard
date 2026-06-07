const cron = require('node-cron');
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

    for (const a of assignments) {
      if (!a.userId || !a.dueDate) continue;
      const dueTime = new Date(a.dueDate).getTime();

      // Due in ~6 hours
      if (dueTime > now.getTime() && dueTime < in6h.getTime() && dueTime > now.getTime() - 5 * 60 * 1000) {
        await sendAssignmentNotification(a, a.userId);
      }
      // Due in ~24 hours
      if (dueTime > now.getTime() && dueTime < in24h.getTime() && dueTime > now.getTime() - 5 * 60 * 1000) {
        await sendAssignmentNotification(a, a.userId);
      }
    }
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

    for (const t of tasks) {
      if (!t.user) continue;
      const taskTime = new Date(t.dueDate).getTime();

      if (taskTime > now.getTime() && taskTime < in15min.getTime()) {
        await sendSessionNotification(t, t.user, 0);
      }
    }
  } catch (err) {
    console.error('[CheckSessions]', err.message);
  }
}

// Run risk intelligence
async function checkRisks() {
  try {
    const User = require('../models/User');
    const users = await User.find({ role: 'student' }).select('_id').lean();
    for (const u of users) {
      await checkAcademicRisks(u._id);
    }
  } catch (err) {
    console.error('[CheckRisks]', err.message);
  }
}

function startNotificationJobs() {
  // Every hour
  cron.schedule('0 * * * *', () => {
    console.log('[Cron] Checking deadlines...');
    checkDeadlines();
    checkRisks();
  }, { timezone: 'Asia/Kolkata' });

  // Every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    console.log('[Cron] Checking sessions...');
    checkSessions();
  }, { timezone: 'Asia/Kolkata' });

  console.log('[Cron] Notification jobs scheduled.');
}

module.exports = { startNotificationJobs, checkDeadlines, checkSessions, checkRisks };
