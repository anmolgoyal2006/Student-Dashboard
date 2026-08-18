const admin = require('../config/firebaseAdmin');
const NotificationToken = require('../models/NotificationToken');
const Notification = require('../models/Notification');

// ─── Atomic dedup helper ─────────────────────────────────────────────────────
// Uses a raw updateOne so we get `upsertedCount` back — the ONLY reliable way
// to know if this call was the first one (insert) vs a duplicate (no-op).
// `findOneAndUpdate` with `new:true` always returns a doc but can't tell you
// whether it was just created or already existed.
//
// dedupKey must be unique per "logical notification":
//   - Attendance: type + subject name + UTC date
//   - Assignment: type + assignment ID + UTC date  (NOT the title — titles like
//     "❌ Overdue" are shared across all assignments)
//   - Session: type + task ID + UTC date
//
async function tryInsert(doc) {
  const col = Notification.collection;
  const now = new Date();
  const result = await col.updateOne(
    { userId: doc.userId, dedupKey: doc.dedupKey },      // filter on the unique key
    {
      $setOnInsert: {
        ...doc,
        read      : false,
        createdAt : now,
        updatedAt : now,
      },
    },
    { upsert: true }
  );
  // upsertedCount === 1 means a new document was inserted → first caller wins
  return result.upsertedCount === 1;
}

// Build a dedupKey that is stable per notification type + entity + UTC day.
function makeDedupKey(type, entityId, day) {
  return `${type}:${entityId}:${day}`;
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// ─── Core send function ──────────────────────────────────────────────────────
async function sendNotification(userId, title, body, data = {}) {
  try {
    const type = data.type || 'INFO';
    const day  = todayUTC();

    // Pick a stable entity ID for the dedupKey so different assignments/tasks
    // with the same urgency title don't collide with each other.
    const entityId =
      data.assignmentId ||   // assignment notifications
      data.taskId        ||   // session notifications
      data.subjectId     ||   // attendance notifications (fallback)
      title;                  // generic notifications: title is the entity

    const dedupKey = makeDedupKey(type, entityId, day);

    const doc = {
      userId,
      title,
      body,
      type,
      dedupKey,
      courseName : data.courseName  || null,
      subjectId  : data.subjectId   || null,
    };

    // Atomic insert-or-skip
    const isNew = await tryInsert(doc);
    if (!isNew) {
      console.log(`[FCM] Duplicate skipped: "${title}" (${type}) for user ${userId}`);
      return { success: false, reason: 'Duplicate within 24h' };
    }

    // ── Gather push tokens ────────────────────────────────────────────────
    const tokens = await NotificationToken.find({ userId }).lean();
    if (!tokens.length) {
      const User = require('../models/User');
      const user = await User.findById(userId).select('fcmToken').lean();
      if (user?.fcmToken) {
        tokens.push({ token: user.fcmToken, platform: 'web', userId });
      }
    }
    if (!tokens.length) {
      console.log(`[FCM] No tokens for user ${userId} — saved to DB only`);
      return { success: false, reason: 'No tokens' };
    }

    // ── Send to ONE token (most recent) — one push per notification ───────
    const sortedTokens = [...tokens].sort((a, b) => (b._id > a._id ? 1 : -1));

    const message = {
      notification: { title, body },
      data: {
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
    };

    for (const t of sortedTokens) {
      try {
        await admin.messaging().send({ ...message, token: t.token });
        return { success: true, results: [{ token: t.token, success: true }] };
      } catch (err) {
        if (err.code === 'messaging/invalid-registration-token' ||
            err.code === 'messaging/registration-token-not-registered') {
          await NotificationToken.deleteOne({ userId: t.userId, token: t.token });
        }
        // Try next token
      }
    }

    return { success: false, reason: 'All tokens failed' };
  } catch (err) {
    console.error('[NotificationEngine]', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Assignment notifications ────────────────────────────────────────────────
async function sendAssignmentNotification(assignment, userId) {
  if (assignment.status === 'submitted' || assignment.status === 'returned' || assignment.status === 'completed') {
    return { skipped: true };
  }

  const dueDate    = new Date(assignment.dueDate);
  const now        = new Date();
  const diffHrs    = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  const courseName = assignment.courseName || assignment.subject || 'Classroom';
  // Use the assignment's own ID as the entity so dedupKey is unique per assignment.
  const assignmentId = String(assignment._id || assignment.assignmentId || assignment.title);

  if (diffHrs < 0) {
    return sendNotification(userId, '❌ Overdue', `[${courseName}] ${assignment.title} — submit immediately`,
      { type: 'OVERDUE', assignmentId, courseName });
  }
  if (diffHrs < 6) {
    return sendNotification(userId, '🚨 Due in 6 hours', `[${courseName}] ${assignment.title} — submit now`,
      { type: 'URGENT', assignmentId, courseName });
  }
  if (diffHrs < 24) {
    return sendNotification(userId, '⚠️ Due Tomorrow', `[${courseName}] ${assignment.title} · Est. ${assignment.estimatedHours} hrs`,
      { type: 'DUE_SOON', assignmentId, courseName });
  }
  if (diffHrs < 72) {
    return sendNotification(userId, '📅 Due in 3 days', `[${courseName}] ${assignment.title} · Est. ${assignment.estimatedHours} hrs`,
      { type: 'DUE_SOON', assignmentId, courseName });
  }
  if (diffHrs < 168) {
    return sendNotification(userId, '📌 Due in 7 days', `[${courseName}] ${assignment.title} · Due ${dueDate.toLocaleDateString()}`,
      { type: 'NEW_ASSIGNMENT', assignmentId, courseName });
  }
  return sendNotification(userId, '📚 New Assignment', `[${courseName}] ${assignment.title} · Due ${dueDate.toLocaleDateString()}`,
    { type: 'NEW_ASSIGNMENT', assignmentId, courseName });
}

// ─── Session notifications ───────────────────────────────────────────────────
async function sendSessionNotification(task, userId, minutesBefore) {
  const taskId = task._id.toString();
  if (minutesBefore === 15) {
    return sendNotification(userId, '📖 Starting Soon', `${task.taskTitle} starts in 15 minutes`,
      { type: 'SESSION_SOON', taskId });
  }
  return sendNotification(userId, '🚀 Time to Study', `${task.taskTitle} — your session begins now`,
    { type: 'SESSION_START', taskId });
}

async function sendDigestNotification(userId, title, body) {
  return sendNotification(userId, title, body, { type: 'DIGEST' });
}

module.exports = { sendNotification, sendAssignmentNotification, sendSessionNotification, sendDigestNotification };
