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

// ─── Send a payload to EVERY token a user has ────────────────────────────────
// Returns true if at least one device received the push.
// Invalid tokens are pruned; transient FCM errors are left alone so the next
// cron run can retry them.
async function sendToAllTokens(userTokens, payload, userId) {
  const DEAD_CODES = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
  ]);

  const results = await Promise.allSettled(
    userTokens.map(async (t) => {
      try {
        await admin.messaging().send({ ...payload, token: t.token });
        return { token: t.token, success: true };
      } catch (err) {
        if (DEAD_CODES.has(err.code)) {
          try { await NotificationToken.deleteOne({ userId, token: t.token }); } catch (_) {}
        }
        throw err;
      }
    })
  );

  return results.some((r) => r.status === 'fulfilled');
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

      // ── Push to ALL devices this user is logged in on ──────────────────
      const sent = await sendToAllTokens(userTokens, payload, subject.userId);
      if (sent) {
        totalSent++;
      } else {
        // Every token failed — roll back so the next cron run can retry.
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
    const currentTime = getISTTimeHHMM();   // "HH:MM" in IST
    const dateStr     = getISTDateString();

    // No weekend guard here — subjects can legitimately be scheduled on
    // Sat/Sun (labs, test subjects, makeup classes). The morning digest
    // (sendTodayNotifications) still skips weekends intentionally.

    // Fetch ALL subjects scheduled on this day in one query
    const subjects = await Subject.find({
      schedule: { $elemMatch: { day: dayShort } },
    }).lean();

    if (!subjects.length) return;

    // ── Time window ────────────────────────────────────────────────────────
    // Cron runs every minute but Render free tier can drift by several minutes
    // on cold starts / deploys. We look back DRIFT_WINDOW minutes so a class
    // that ended while the cron was delayed is still caught.
    // The dedup key is anchored to the SLOT's own endTime (not the cron fire
    // time), so even if multiple cron runs fall inside the window, each slot
    // fires at most once per day.
    const DRIFT_WINDOW = 5; // minutes — covers Render free-tier worst-case drift

    function toMinutes(t) {
      if (!t) return null;
      const parts = t.split(':').map(Number);
      if (parts.length < 2 || parts.some(isNaN)) return null;
      return parts[0] * 60 + parts[1];
    }

    const nowMinutes = toMinutes(normalizeTime(currentTime));

    const endingSubjects = [];
    for (const subject of subjects) {
      // A subject can have multiple schedule entries for the same day (e.g.
      // two lab sessions). Collect ALL slots that ended within the window.
      const matchingSlots = subject.schedule.filter((s) => {
        if (s.day !== dayShort) return false;
        const slotEnd = toMinutes(normalizeTime(s.endTime));
        if (slotEnd === null) return false;
        // slotEnd must be in the range (now - DRIFT_WINDOW, now]
        // i.e. the class ended AT MOST DRIFT_WINDOW minutes ago and no more than 0 minutes in the future
        const diff = nowMinutes - slotEnd;
        return diff >= 0 && diff <= DRIFT_WINDOW;
      });
      for (const slot of matchingSlots) {
        endingSubjects.push({ subject, slot });
      }
    }

    if (!endingSubjects.length) return;

    console.log(`[FCM] ${endingSubjects.length} class(es) ending within ${DRIFT_WINDOW}-min window of ${currentTime} IST on ${dayShort}`);

    // Prefetch tokens in one batch query
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

      // ── Dedup key anchored to the SLOT's own endTime, NOT the cron fire time.
      // This means: however many cron runs fall inside the drift window, only
      // the first one that wins the upsert actually sends the push.
      const slotEndNormalized = normalizeTime(slot.endTime);
      const dedupKey = `ATTENDANCE_MARK:${subject._id}:${dateStr}:end:${slotEndNormalized}`;

      const isNew = await tryInsertNotification({
        userId: subject.userId,
        subjectId: subject._id,
        title,
        body,
        type: 'ATTENDANCE_MARK',
        dedupKey,
      });
      if (!isNew) {
        console.log(`[FCM] Skipping duplicate end-of-class for ${subject.name} (slot ${slotEndNormalized})`);
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

      const sent = await sendToAllTokens(userTokens, payload, subject.userId);
      if (sent) {
        console.log(`[FCM] End-of-class notification sent: ${subject.name} (ended ${slotEndNormalized}, cron at ${currentTime} IST)`);
      } else {
        // All tokens failed — roll back so the next cron within the window retries
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
