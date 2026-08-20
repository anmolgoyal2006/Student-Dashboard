// services/notificationService.js
const admin             = require('../config/firebaseAdmin');
const Subject           = require('../models/Subject');
const Notification      = require('../models/Notification');
const NotificationToken = require('../models/NotificationToken');

// ─── IST-aware time helpers ──────────────────────────────────────
// Server likely runs in UTC; all class times are in IST (Asia/Kolkata).
// These helpers return correct IST values regardless of server timezone.

function getISTDayShort() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short'
  });
  return formatter.format(new Date());
}

function getISTTimeHHMM() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  return formatter.format(new Date());
}

function getISTDateString() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
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
  const title = `📚 ${subject.name}`;
  const body = startTime
    ? `Class at ${startTime} — Mark your attendance`
    : 'Mark your attendance for today';

  return {
    data: {
      type:      'ATTENDANCE_MARK',
      subjectId: String(subject._id),
      userId:    String(userId),
      subject:   subject.name,
      time:      startTime || '',
      date:      dateStr,
      title,
      body,
    },
  };
}

async function sendNotification(fcmToken, payload, userId) {
  try {
    await admin.messaging().send({ ...payload, token: fcmToken });
    return true;
  } catch (err) {
    console.error(`[FCM] Failed to send to token ...${fcmToken.slice(-6)}:`, err.message);
    if (userId && (err.code === 'messaging/invalid-registration-token' ||
        err.code === 'messaging/registration-token-not-registered')) {
      try {
        await NotificationToken.deleteOne({ userId, token: fcmToken });
      } catch (_) {}
    }
    return false;
  }
}

// Atomic dedup upsert for attendance notifications.
// Returns true if the doc was newly inserted (we should send the push),
// false if it already existed (duplicate — skip the push).
async function tryInsertNotification(doc) {
  // dedupKey: one notification per subject per IST day.
  // Include subjectId so different subjects on the same day don't collide.
  const day      = getISTDateString();
  const entityId = doc.subjectId ? String(doc.subjectId) : doc.title;
  const dedupKey = doc.dedupKey || `${doc.type}:${entityId}:${day}`;

  const now = new Date();
  try {
    const result = await Notification.collection.updateOne(
      { userId: doc.userId, dedupKey },          // unique filter
      {
        $setOnInsert: {
          ...doc,
          dedupKey,
          read      : false,
          createdAt : now,
          updatedAt : now,
        },
      },
      { upsert: true }
    );
    // upsertedCount === 1 → new document inserted → send the push
    // upsertedCount === 0 → doc already existed → duplicate, skip
    return result.upsertedCount === 1;
  } catch (err) {
    console.error('[FCM] Dedup upsert failed:', err.message);
    return false;
  }
}

// Guard flags — prevent overlapping cron executions for both jobs
let isTodayRunning = false;
let isEndOfClassRunning = false;

// ─── Start-of-day reminder ───────────────────────────────────────
async function sendTodayNotifications() {
  if (isTodayRunning) return;
  isTodayRunning = true;

  try {
    const dayShort = getISTDayShort();
    const dateStr  = getISTDateString();
    const subjects = await fetchTodaySubjects(dayShort);

    if (!subjects.length) {
      console.log(`[FCM] No subjects found for ${dayShort}.`);
      return;
    }

    // Prefetch all notification tokens for the user IDs in subjects in one batch query
    const userIds = [...new Set(subjects.map(s => String(s.userId)))];
    const tokenDocs = await NotificationToken.find({ userId: { $in: userIds } }).sort({ _id: -1 }).lean();
    const tokenMap = {};
    for (const doc of tokenDocs) {
      const uId = String(doc.userId);
      if (!tokenMap[uId]) tokenMap[uId] = [];
      tokenMap[uId].push(doc);
    }

    let totalSent = 0;

    for (const subject of subjects) {
      const todaySchedule = subject.schedule.find((s) => s.day === dayShort);
      if (!todaySchedule) continue;

      const startTime = todaySchedule.startTime || '';

      const userTokens = tokenMap[String(subject.userId)] || [];
      if (!userTokens.length) continue;

      const payload = buildPayload(subject, subject.userId, startTime, dateStr);
      const title   = payload.data.title;
      const body    = payload.data.body;
      const dedupKey = `ATTENDANCE_MARK:${subject._id}:${dateStr}:morning`;

      // ── Atomic dedup: insert only if not already sent today ──
      const isNew = await tryInsertNotification({
        userId: subject.userId,
        subjectId: subject._id,
        title,
        body,
        type: 'ATTENDANCE_MARK',
        dedupKey,
      });
      if (!isNew) {
        console.log(`[FCM] Skipping duplicate start-of-day for ${subject.name}`);
        continue;
      }

      let sent = false;
      for (const t of userTokens) {
        sent = await sendNotification(t.token, payload, subject.userId);
        if (sent) break;
      }
      if (sent) {
        totalSent++;
      } else {
        // FCM failed to send — remove notification from DB so it can be retried in the next cron execution
        try {
          await Notification.collection.deleteOne({ userId: subject.userId, dedupKey });
        } catch (err) {
          console.error('[FCM] Failed to delete failed notification record:', err.message);
        }
      }
    }

    console.log(`[FCM] Total start-of-day notifications sent: ${totalSent}`);
  } finally {
    isTodayRunning = false;
  }
}

function normalizeTime(timeStr) {
  if (!timeStr) return '';
  let str = timeStr.trim().toUpperCase();
  const match12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2];
    const ampm = match12[3];
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }
  
  const match24 = str.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = match24[2];
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }
  
  return str;
}

// ─── End-of-class "Did you attend?" prompt ───────────────────────
async function sendEndOfClassNotifications() {
  if (isEndOfClassRunning) return;
  isEndOfClassRunning = true;

  try {
    const dayShort = getISTDayShort();
    const currentTime = getISTTimeHHMM();
    const dateStr     = getISTDateString();

    if (dayShort === 'Sat' || dayShort === 'Sun') return;

    // Fetch all subjects with classes on this day
    const subjects = await Subject.find({
      schedule: {
        $elemMatch: { day: dayShort },
      },
    }).lean();

    if (!subjects.length) return;

    const normalizedCurrentTime = normalizeTime(currentTime);
    const endingSubjects = [];

    for (const subject of subjects) {
      const slot = subject.schedule.find(
        (s) => s.day === dayShort && normalizeTime(s.endTime) === normalizedCurrentTime
      );
      if (slot) {
        endingSubjects.push({ subject, slot });
      }
    }

    if (!endingSubjects.length) return;

    console.log(`[FCM] ${endingSubjects.length} class(es) ending at ${currentTime} IST on ${dayShort}`);

    // Prefetch all notification tokens for the user IDs in subjects in one batch query
    const userIds = [...new Set(endingSubjects.map(item => String(item.subject.userId)))];
    const tokenDocs = await NotificationToken.find({ userId: { $in: userIds } }).sort({ _id: -1 }).lean();
    const tokenMap = {};
    for (const doc of tokenDocs) {
      const uId = String(doc.userId);
      if (!tokenMap[uId]) tokenMap[uId] = [];
      tokenMap[uId].push(doc);
    }

    for (const { subject, slot } of endingSubjects) {
      const userTokens = tokenMap[String(subject.userId)] || [];
      if (!userTokens.length) continue;

      const title = `📋 Did you attend ${subject.name}?`;
      const body  = `Class just ended${slot.room ? ` in ${slot.room}` : ''}. Mark your attendance.`;
      const dedupKey = `ATTENDANCE_MARK:${subject._id}:${dateStr}:end:${normalizedCurrentTime}`;

      // ── Atomic dedup: insert only once per class-end per day ──
      const isNew = await tryInsertNotification({
        userId: subject.userId,
        subjectId: subject._id,
        title,
        body,
        type: 'ATTENDANCE_MARK',
        dedupKey,
      });
      if (!isNew) {
        console.log(`[FCM] Skipping duplicate end-of-class for ${subject.name}`);
        continue;
      }

      const payload = {
        data: {
          type     : 'ATTENDANCE_MARK',
          subjectId: String(subject._id),
          userId   : String(subject.userId),
          subject  : subject.name,
          date     : dateStr,
          title,
          body,
        },
      };

      let sent = false;
      for (const t of userTokens) {
        sent = await sendNotification(t.token, payload, subject.userId);
        if (sent) break;
      }
      if (sent) {
        console.log(`[FCM] End-of-class notification sent: ${subject.name} at ${currentTime} IST`);
      } else {
        // FCM failed to send — remove notification from DB so it can be retried in the next cron execution
        try {
          await Notification.collection.deleteOne({ userId: subject.userId, dedupKey });
        } catch (err) {
          console.error('[FCM] Failed to delete failed notification record:', err.message);
        }
      }
    }
  } finally {
    isEndOfClassRunning = false;
  }
}

module.exports = { sendTodayNotifications, sendEndOfClassNotifications, sendNotification, buildPayload };
