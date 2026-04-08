// services/notificationService.js
const admin        = require('../config/firebaseAdmin');
const Subject      = require('../models/Subject');
const User         = require('../models/User');
const Notification = require('../models/Notification');   // ← NEW

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getTodayName() {
  return DAYS[new Date().getDay()];
}

async function fetchTodaySubjects() {
  const today = getTodayName();

  if (today === 'Sun' || today === 'Sat') {
    console.log('[FCM] Weekend — no notifications sent.');
    return [];
  }

  const subjects = await Subject.find({
    schedule: { $elemMatch: { day: today } },
  }).lean();

  return subjects;
}

function buildPayload(subject, userId, startTime) {
  return {
    notification: {
      title: `📚 ${subject.name}`,
      body: startTime
        ? `Class at ${startTime} — Mark your attendance`
        : 'Mark your attendance for today',
    },
    data: {
      type:      'ATTENDANCE_MARK',
      subjectId: String(subject._id),
      userId:    String(userId),
      subject:   subject.name,
      time:      startTime || '',
      date:      new Date().toISOString().split('T')[0],
    },
    webpush: {
      notification: {
        title: `📚 ${subject.name}`,
        body: startTime
          ? `Class at ${startTime} — Mark your attendance`
          : 'Mark your attendance for today',
        icon:  '/logo192.png',
        badge: '/logo192.png',
        actions: [
          { action: 'attended',     title: '✅ Attended'    },
          { action: 'not_attended', title: '❌ Not Attended' },
          { action: 'not_held',     title: '⏸️ Not Held'    },
        ],
        data: {
          type:      'ATTENDANCE_MARK',
          subjectId: String(subject._id),
          userId:    String(userId),
          subject:   subject.name,
          time:      startTime || '',
          date:      new Date().toISOString().split('T')[0],
        },
      },
      fcmOptions: {},
    },
  };
}

async function sendNotification(fcmToken, payload) {
  try {
    await admin.messaging().send({ ...payload, token: fcmToken });
    return true;
  } catch (err) {
    console.error(`[FCM] Failed to send to token ...${fcmToken.slice(-6)}:`, err.message);
    return false;
  }
}

// ─── NEW: saves one Notification doc to MongoDB ───────────────────────────────
async function saveNotificationToDB(userId, subjectId, title, body) {
  try {
    console.log("💾 Saving notification:", { userId, subjectId, title });

    const saved = await Notification.create({
      userId,
      subjectId,
      title,
      body
    });

    console.log("✅ Saved to DB:", saved._id);
  } catch (err) {
    console.error("❌ DB SAVE ERROR:", err.message);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

async function sendTodayNotifications() {
  const today    = getTodayName();
  const subjects = await fetchTodaySubjects();

  if (!subjects.length) {
    console.log('[FCM] No subjects found for today.');
    return;
  }

  let totalSent = 0;

  for (const subject of subjects) {
    const { userId, schedule } = subject;

    const todaySchedule = schedule.find((s) => s.day === today);
    if (!todaySchedule) continue;

    const startTime = todaySchedule.startTime || '';

   const user = await User.findById(userId).select('fcmToken').lean();
if (!user || !user.fcmToken) continue;

const tokens = [user.fcmToken];

    const payload = buildPayload(subject, userId, startTime);

    // ── NEW: save ONCE per subject (not once per token) ──────────────────────
    await saveNotificationToDB(
      userId,
      subject._id,
      payload.notification.title,
      payload.notification.body
    );
    // ─────────────────────────────────────────────────────────────────────────

    for (const token of tokens) {
      const sent = await sendNotification(token, payload);
      if (sent) totalSent++;
    }
  }

  console.log(`[FCM] Total notifications sent today: ${totalSent}`);
}

module.exports = { sendTodayNotifications, sendNotification, buildPayload };