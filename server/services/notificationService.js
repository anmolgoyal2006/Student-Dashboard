// services/notificationService.js
const admin        = require('../config/firebaseAdmin');
const Subject      = require('../models/Subject');
const User         = require('../models/User');
const Notification = require('../models/Notification');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── IST-aware time helpers ──────────────────────────────────────
// Server likely runs in UTC; all class times are in IST (Asia/Kolkata).
// These helpers return correct IST values regardless of server timezone.

function getISTDate() {
  const now = new Date();
  // IST offset = UTC +5:30
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffsetMs);
}

function getISTDayShort() {
  return DAYS[getISTDate().getUTCDay()];
}

function getISTTimeHHMM() {
  const d = getISTDate();
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function getISTDateString() {
  const d = getISTDate();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────

async function fetchTodaySubjects(dayShort) {
  if (dayShort === 'Sat' || dayShort === 'Sun') {
    console.log(`[FCM] ${dayShort} — no notifications sent.`);
    return [];
  }

  const subjects = await Subject.find({
    schedule: { $elemMatch: { day: dayShort } },
  }).lean();

  return subjects;
}

function buildPayload(subject, userId, startTime, dateStr) {
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
      date:      dateStr,
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
          date:      dateStr,
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

async function saveNotificationToDB(userId, subjectId, title, body) {
  try {
    console.log("💾 Saving notification:", { userId, subjectId, title });
    const saved = await Notification.create({ userId, subjectId, title, body });
    console.log("✅ Saved to DB:", saved._id);
  } catch (err) {
    console.error("❌ DB SAVE ERROR:", err.message);
  }
}

// ─── Start-of-day reminder ───────────────────────────────────────
async function sendTodayNotifications() {
  const dayShort = getISTDayShort();
  const dateStr  = getISTDateString();
  const subjects = await fetchTodaySubjects(dayShort);

  if (!subjects.length) {
    console.log(`[FCM] No subjects found for ${dayShort}.`);
    return;
  }

  let totalSent = 0;

  for (const subject of subjects) {
    const todaySchedule = subject.schedule.find((s) => s.day === dayShort);
    if (!todaySchedule) continue;

    const startTime = todaySchedule.startTime || '';

    const user = await User.findById(subject.userId).select('fcmToken').lean();
    if (!user || !user.fcmToken) continue;

    const tokens = [user.fcmToken];
    const payload = buildPayload(subject, subject.userId, startTime, dateStr);

    await saveNotificationToDB(subject.userId, subject._id, payload.notification.title, payload.notification.body);

    for (const token of tokens) {
      const sent = await sendNotification(token, payload);
      if (sent) totalSent++;
    }
  }

  console.log(`[FCM] Total start-of-day notifications sent: ${totalSent}`);
}

// ─── End-of-class "Did you attend?" prompt ───────────────────────
async function sendEndOfClassNotifications() {
  const dayShort = getISTDayShort();
  const currentTime = getISTTimeHHMM();
  const dateStr     = getISTDateString();

  if (dayShort === 'Sat' || dayShort === 'Sun') return;

  // Also build 12h format for safety
  const [h, m] = currentTime.split(':').map(Number);
  const hours12 = h % 12 || 12;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const currentTime12 = `${hours12}:${String(m).padStart(2, '0')} ${ampm}`;

  const subjects = await Subject.find({
    schedule: {
      $elemMatch: {
        day    : dayShort,
        endTime: { $in: [currentTime, currentTime12] },
      },
    },
  }).lean();

  if (!subjects.length) return;

  console.log(`[FCM] ${subjects.length} class(es) ending at ${currentTime} IST on ${dayShort}`);

  for (const subject of subjects) {
    const user = await User.findById(subject.userId).select('fcmToken').lean();
    if (!user?.fcmToken) continue;

    const slot = subject.schedule.find(
      (s) => s.day === dayShort && [currentTime, currentTime12].includes(s.endTime)
    );

    const title = `📋 Did you attend ${subject.name}?`;
    const body = `Class just ended${slot?.room ? ` in ${slot.room}` : ''}. Mark your attendance.`;

    const payload = {
      notification: { title, body },
      data: {
        type     : 'ATTENDANCE_MARK',
        subjectId: String(subject._id),
        userId   : String(subject.userId),
        subject  : subject.name,
        date     : dateStr,
      },
      webpush: {
        notification: {
          title,
          body,
          icon   : '/logo192.png',
          badge  : '/logo192.png',
          actions: [
            { action: 'attended',     title: '✅ Attended'    },
            { action: 'not_attended', title: '❌ Not Attended' },
            { action: 'not_held',     title: '⏸️ Not Held'    },
          ],
          data: {
            type     : 'ATTENDANCE_MARK',
            subjectId: String(subject._id),
            userId   : String(subject.userId),
            subject  : subject.name,
            date     : dateStr,
          },
        },
      },
    };

    await sendNotification(user.fcmToken, payload);
    await saveNotificationToDB(subject.userId, subject._id, title, body);

    console.log(`[FCM] End-of-class notification sent: ${subject.name} at ${currentTime} IST`);
  }
}

module.exports = { sendTodayNotifications, sendEndOfClassNotifications, sendNotification, buildPayload };
