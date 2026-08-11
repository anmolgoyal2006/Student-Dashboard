const admin = require('../config/firebaseAdmin');
const NotificationToken = require('../models/NotificationToken');
const Notification = require('../models/Notification');

async function sendNotification(userId, title, body, data = {}) {
  try {
    // ── Deduplication: skip if same title+body+type was sent to this user in the last 24h ──
    // We include `body` in the key so two different assignments with the same urgency tier
    // (same title like "🚨 Due in 6 hours") are treated as distinct notifications.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentDupe = await Notification.findOne({
      userId,
      title,
      body,
      type: data.type || 'INFO',
      createdAt: { $gte: since },
    }).lean();
    if (recentDupe) {
      console.log(`[FCM] Skipping duplicate notification "${title}" for user ${userId}`);
      return { success: false, reason: 'Duplicate within 24h' };
    }

    const tokens = await NotificationToken.find({ userId }).lean();
    if (!tokens.length) {
      const User = require('../models/User');
      const user = await User.findById(userId).select('fcmToken');
      if (user?.fcmToken) {
        tokens.push({ token: user.fcmToken, platform: 'web', userId });
      } else {
        console.log(`[FCM] No tokens found for user ${userId}`);
      }
    }
    if (!tokens.length) {
      console.log(`[FCM] Skipping push — no tokens for user ${userId}`);
      // Still save the notification to DB
      await Notification.create({ userId, title, body, type: data.type || 'INFO', courseName: data.courseName || null });
      return { success: false, reason: 'No tokens' };
    }

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
          await NotificationToken.deleteOne({ userId: t.userId, token: t.token });
        }
        results.push({ token: t.token, success: false, error: err.code });
      }
    }

    await Notification.create({ userId, title, body, type: data.type || 'INFO', courseName: data.courseName || null });

    return { success: true, results };
  } catch (err) {
    console.error('[NotificationEngine]', err.message);
    return { success: false, error: err.message };
  }
}

async function sendAssignmentNotification(assignment, userId) {
  // Skip if already submitted or completed
  if (assignment.status === 'submitted' || assignment.status === 'returned' || assignment.status === 'completed') return { skipped: true };

  const dueDate = new Date(assignment.dueDate);
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);
  const courseName = assignment.courseName || assignment.subject || 'Classroom';

  if (diffHrs < 0) {
    return sendNotification(userId, '❌ Overdue', `[${courseName}] ${assignment.title} — submit immediately`, { type: 'OVERDUE', assignmentId: assignment.assignmentId, courseName });
  }
  if (diffHrs < 6) {
    return sendNotification(userId, '🚨 Due in 6 hours', `[${courseName}] ${assignment.title} — submit now`, { type: 'URGENT', assignmentId: assignment.assignmentId, courseName });
  }
  if (diffHrs < 24) {
    return sendNotification(userId, '⚠️ Due Tomorrow', `[${courseName}] ${assignment.title} · Est. ${assignment.estimatedHours} hrs`, { type: 'DUE_SOON', assignmentId: assignment.assignmentId, courseName });
  }
  if (diffHrs < 72) {
    return sendNotification(userId, '📅 Due in 3 days', `[${courseName}] ${assignment.title} · Est. ${assignment.estimatedHours} hrs`, { type: 'DUE_SOON', assignmentId: assignment.assignmentId, courseName });
  }
  if (diffHrs < 168) {
    return sendNotification(userId, '📌 Due in 7 days', `[${courseName}] ${assignment.title} · Due ${dueDate.toLocaleDateString()}`, { type: 'NEW_ASSIGNMENT', assignmentId: assignment.assignmentId, courseName });
  }
  return sendNotification(userId, '📚 New Assignment', `[${courseName}] ${assignment.title} · Due ${dueDate.toLocaleDateString()}`, { type: 'NEW_ASSIGNMENT', assignmentId: assignment.assignmentId, courseName });
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
