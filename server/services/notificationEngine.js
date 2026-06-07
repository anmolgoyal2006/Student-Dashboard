const admin = require('firebase-admin');
const NotificationToken = require('../models/NotificationToken');
const Notification = require('../models/Notification');

async function sendNotification(userId, title, body, data = {}) {
  try {
    const tokens = await NotificationToken.find({ userId }).lean();
    if (!tokens.length) {
      const User = require('../models/User');
      const user = await User.findById(userId).select('fcmToken');
      if (user?.fcmToken) {
        tokens.push({ token: user.fcmToken, platform: 'web' });
      }
    }
    if (!tokens.length) return { success: false, reason: 'No tokens' };

    const message = {
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
    };

    const results = [];
    for (const t of tokens) {
      try {
        await admin.messaging().send({ ...message, token: t.token });
        results.push({ token: t.token, success: true });
      } catch (err) {
        if (err.code === 'messaging/invalid-registration-token' ||
            err.code === 'messaging/registration-token-not-registered') {
          await NotificationToken.deleteOne({ token: t.token });
        }
        results.push({ token: t.token, success: false, error: err.code });
      }
    }

    await Notification.create({ userId, title, body, type: data.type || 'CLASSROOM' });

    return { success: true, results };
  } catch (err) {
    console.error('[NotificationEngine]', err.message);
    return { success: false, error: err.message };
  }
}

async function sendAssignmentNotification(assignment, userId) {
  const dueDate = new Date(assignment.dueDate);
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);

  if (diffHrs < 0) {
    return sendNotification(userId, '❌ Overdue', `${assignment.title} — submit immediately`, { type: 'OVERDUE', assignmentId: assignment.assignmentId });
  }
  if (diffHrs < 6) {
    return sendNotification(userId, '🚨 Urgent Deadline', `${assignment.title} due in 6 hours`, { type: 'URGENT', assignmentId: assignment.assignmentId });
  }
  if (diffHrs < 24) {
    return sendNotification(userId, '⚠️ Due Tomorrow', `${assignment.title} · Est. ${assignment.estimatedHours} hrs`, { type: 'DUE_SOON', assignmentId: assignment.assignmentId });
  }
  return sendNotification(userId, '📚 New Assignment', `${assignment.title} · Due ${dueDate.toLocaleDateString()}`, { type: 'NEW_ASSIGNMENT', assignmentId: assignment.assignmentId });
}

async function sendSessionNotification(task, userId, minutesBefore) {
  if (minutesBefore === 15) {
    return sendNotification(userId, '📖 Starting Soon', `${task.taskTitle} starts in 15 minutes`, { type: 'SESSION_SOON', taskId: task._id.toString() });
  }
  return sendNotification(userId, '🚀 Time to Study', `${task.taskTitle} — your session begins now`, { type: 'SESSION_START', taskId: task._id.toString() });
}

async function sendDigestNotification(userId, title, body) {
  return sendNotification(userId, title, body, { type: 'DIGEST' });
}

module.exports = { sendNotification, sendAssignmentNotification, sendSessionNotification, sendDigestNotification };
