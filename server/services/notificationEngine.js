const admin = require('../config/firebaseAdmin');
const NotificationToken = require('../models/NotificationToken');
const Notification = require('../models/Notification');

// Build a stable dedup key scoped to a 24-hour window (UTC date string).
// Two calls with the same userId+type+title within the same UTC day share the
// same key, so the unique index on Notification rejects the second insert.
function buildDedupKey(type, title) {
  const day = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  return `${type}:${title}:${day}`;
}

async function sendNotification(userId, title, body, data = {}) {
  try {
    const type     = data.type || 'INFO';
    const dedupKey = buildDedupKey(type, title);

    // ── Atomic deduplication via unique index ──────────────────────────────
    // findOneAndUpdate with upsert=true either:
    //   (a) inserts a new doc  → we are the first caller, proceed to send push
    //   (b) throws E11000      → duplicate key, another call already handled it
    // This is atomic and race-condition-safe unlike a findOne + create pair.
    let notifDoc;
    try {
      notifDoc = await Notification.findOneAndUpdate(
        { userId, type, title, dedupKey },                         // filter
        { $setOnInsert: { userId, type, title, body,              // only written on insert
            dedupKey,
            courseName: data.courseName || null,
            read: false,
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        // Duplicate key — already sent within this dedup window
        console.log(`[FCM] Skipping duplicate notification "${title}" for user ${userId}`);
        return { success: false, reason: 'Duplicate within 24h' };
      }
      throw dupErr;
    }

    // If the doc already existed (upsert didn't insert a new one), it's a dupe.
    // Mongoose returns the existing doc with `new:true`, but we can detect it
    // via the createdAt vs updatedAt or simply check if body matches.
    // Safer: rely on dedupKey uniqueness — if findOneAndUpdate succeeded without
    // throwing, the doc is either new (we should send) or pre-existing (skip).
    // We distinguish by checking whether the returned doc's createdAt equals updatedAt
    // (new insert) vs not. However the simplest reliable approach: check if the
    // returned doc was just created (within last 2 seconds).
    const isNewDoc = (Date.now() - notifDoc.createdAt.getTime()) < 2000;
    if (!isNewDoc) {
      console.log(`[FCM] Skipping duplicate notification "${title}" for user ${userId}`);
      return { success: false, reason: 'Duplicate within 24h' };
    }

    // ── Gather push tokens ────────────────────────────────────────────────
    const tokens = await NotificationToken.find({ userId }).lean();
    if (!tokens.length) {
      const User = require('../models/User');
      const user = await User.findById(userId).select('fcmToken');
      if (user?.fcmToken) {
        tokens.push({ token: user.fcmToken, platform: 'web', userId });
      }
    }
    if (!tokens.length) {
      console.log(`[FCM] Skipping push — no tokens for user ${userId}`);
      return { success: false, reason: 'No tokens' };
    }

    // ── Send push to exactly ONE token (most recent) to avoid per-device dupes ──
    // Sort tokens newest-first (by _id) and send to the first valid one only.
    const sortedTokens = [...tokens].sort((a, b) => (b._id > a._id ? 1 : -1));

    const message = {
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
    };

    const results = [];
    for (const t of sortedTokens) {
      try {
        await admin.messaging().send({ ...message, token: t.token });
        results.push({ token: t.token, success: true });
        break; // ← send to ONE token only; the notification doc is already saved
      } catch (err) {
        if (err.code === 'messaging/invalid-registration-token' ||
            err.code === 'messaging/registration-token-not-registered') {
          await NotificationToken.deleteOne({ userId: t.userId, token: t.token });
        }
        results.push({ token: t.token, success: false, error: err.code });
        // Try the next token
      }
    }

    return { success: results.some(r => r.success), results };
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
