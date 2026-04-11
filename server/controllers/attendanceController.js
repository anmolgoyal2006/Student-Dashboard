// ============================================================
// attendance.controller.js — Smart Attendance Backend
// CHANGES:
//   1. markAttendance: validates subjectId ownership + rejects future dates
//   2. getAttendanceSummary: adds neededClasses, missN predictions, streak
//   3. getBySubject: added pagination + date range filter support
//   4. getMonthlyTrends: sorted chronologically, handles sparse months cleanly
//   5. All routes: consistent error logging, safe error messages to client
// ============================================================

const Attendance = require('../models/Attendance');
const Subject    = require('../models/Subject');
const User       = require('../models/User');

// ── Shared pure helpers ───────────────────────────────────────────────────────

/**
 * Classes needed to bring attendance up to 75%.
 * Formula: ceil((0.75 * total - present) / 0.25)
 */
const neededToReach75 = (total, present) => {
  if (total === 0 || present / total >= 0.75) return 0;
  return Math.ceil((0.75 * total - present) / 0.25);
};

/**
 * Projected attendance % if student misses `miss` upcoming classes.
 */
const projectMiss = (total, present, miss) => {
  const newTotal = total + miss;
  if (newTotal === 0) return 100;
  return +((present / newTotal) * 100).toFixed(1);
};

/**
 * Derives a human-readable status label from percentage.
 */
const statusLabel = pct =>
  pct >= 75 ? 'safe' : pct >= 60 ? 'at_risk' : 'critical';

// ─────────────────────────────────────────────────────────────────────────────

// POST /api/attendance
// [CHANGED] Validates subjectId belongs to user; rejects future dates
exports.markAttendance = async (req, res) => {
  const { subjectId, date, status } = req.body;
  const userId = req.user.id;

  // [CHANGED] Input validation
  if (!subjectId || !date || !status) {
    return res.status(400).json({ message: 'subjectId, date, and status are required.' });
  }

  const allowedStatuses = ['present', 'absent', 'cancelled'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${allowedStatuses.join(', ')}` });
  }

  // [CHANGED] Reject future dates
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return res.status(400).json({ message: 'Invalid date format.' });
  }
  if (parsedDate > new Date()) {
    return res.status(400).json({ message: 'Cannot mark attendance for a future date.' });
  }

  try {
    // [CHANGED] Ensure subject belongs to this user (prevent cross-user manipulation)
    const subject = await Subject.findOne({ _id: subjectId, userId });
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    const record = await Attendance.findOneAndUpdate(
      { userId, subjectId, date: parsedDate },
      { status },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ message: 'Attendance marked', attendance: record });
  } catch (err) {
    console.error('[markAttendance]', err);
    res.status(500).json({ message: 'Failed to mark attendance.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

// GET /api/attendance/summary
// [CHANGED] Now includes: neededClasses, missNClasses prediction, streak, statusLabel
exports.getAttendanceSummary = async (req, res) => {
  const userId = req.user.id;

  try {
    const records = await Attendance
      .find({ userId })
      .populate('subjectId', 'name code credits')
      .sort({ date: 1 }); // chronological for streak calculation

    // [CHANGED] Build per-subject map with streak tracking
    const map = {};

    for (const r of records) {
      if (!r.subjectId) continue;

      const key = r.subjectId._id.toString();

      if (!map[key]) {
        map[key] = {
          subject       : r.subjectId.name,
          code          : r.subjectId.code,
          credits       : r.subjectId.credits ?? null,
          total         : 0,
          present       : 0,
          absent        : 0,
          currentStreak : 0, // consecutive present classes
          lastStatuses  : [], // track last N statuses for streak
        };
      }

      if (r.status === 'cancelled') continue; // cancelled does not count

      map[key].total++;

      if (r.status === 'present') {
        map[key].present++;
        map[key].lastStatuses.push('present');
      } else {
        map[key].absent++;
        map[key].lastStatuses.push('absent');
      }
    }

    // [CHANGED] Compute streak (consecutive present from most recent)
    for (const key of Object.keys(map)) {
      const s = map[key].lastStatuses;
      let streak = 0;
      for (let i = s.length - 1; i >= 0; i--) {
        if (s[i] === 'present') streak++;
        else break;
      }
      map[key].currentStreak = streak;
      delete map[key].lastStatuses; // clean up before sending
    }

    // [CHANGED] Build enriched summary
    const summary = Object.values(map).map(s => {
      const percentage = s.total ? +((s.present / s.total) * 100).toFixed(1) : null;
      const needed     = percentage !== null ? neededToReach75(s.total, s.present) : null;

      return {
        subject      : s.subject,
        code         : s.code,
        credits      : s.credits,
        total        : s.total,
        present      : s.present,
        absent       : s.absent,

        // [CHANGED] null instead of 0 when no data, avoids misleading "0%" display
        percentage,

        // [CHANGED] Status enum: safe | at_risk | critical | no_data
        status       : percentage !== null ? statusLabel(percentage) : 'no_data',

        // [CHANGED] Kept for backward compat; frontend can also use `status`
        isLow        : percentage !== null ? percentage < 75 : false,

        // [CHANGED] Smart insights
        neededClasses: needed,
        missPredict  : percentage !== null ? {
          miss1: projectMiss(s.total, s.present, 1),
          miss2: projectMiss(s.total, s.present, 2),
          miss5: projectMiss(s.total, s.present, 5),
        } : null,

        // [CHANGED] Streak of consecutive present classes
        currentStreak: s.currentStreak,
      };
    });

    // [CHANGED] Top-level overview counts for the frontend insight cards
    const overview = {
      safe    : summary.filter(s => s.status === 'safe').length,
      atRisk  : summary.filter(s => s.status === 'at_risk').length,
      critical: summary.filter(s => s.status === 'critical').length,
      total   : summary.length,
    };

    res.json({ summary, overview });

  } catch (err) {
    console.error('[getAttendanceSummary]', err);
    res.status(500).json({ message: 'Failed to fetch attendance summary.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

// GET /api/attendance/:subjectId
// [CHANGED] Added optional ?from=&to= date range and ?page= pagination
exports.getBySubject = async (req, res) => {
  const userId    = req.user.id;
  const { subjectId } = req.params;
  const { from, to, page = 1, limit = 30 } = req.query;

  try {
    // [CHANGED] Verify subject belongs to user
    const subject = await Subject.findOne({ _id: subjectId, userId });
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    const filter = { userId, subjectId };

    // [CHANGED] Optional date range filter
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to)   filter.date.$lte = new Date(to);
    }

    const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Attendance.countDocuments(filter);

    const records = await Attendance
      .find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      records,
      pagination: {
        total,
        page    : parseInt(page, 10),
        pages   : Math.ceil(total / parseInt(limit, 10)),
        limit   : parseInt(limit, 10),
      },
    });

  } catch (err) {
    console.error('[getBySubject]', err);
    res.status(500).json({ message: 'Failed to fetch subject attendance.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

// GET /api/attendance/trends
// [CHANGED] Sorted chronologically; supports ?months= param; cleaner month key
exports.getMonthlyTrends = async (req, res) => {
  const userId = req.user.id;
  const monthsBack = Math.min(parseInt(req.query.months, 10) || 6, 12); // cap at 12

  try {
    const since = new Date();
    since.setMonth(since.getMonth() - monthsBack);
    since.setDate(1); // start from first of that month

    const records = await Attendance.find({
      userId,
      date  : { $gte: since },
      status: { $ne: 'cancelled' }, // [CHANGED] filter at DB level instead of in JS
    });

    // [CHANGED] Use YYYY-MM key so months sort correctly
    const trendMap = {};

    for (const r of records) {
      const d     = new Date(r.date);
      const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });

      if (!trendMap[key]) {
        trendMap[key] = { month: label, present: 0, total: 0 };
      }

      trendMap[key].total++;
      if (r.status === 'present') trendMap[key].present++;
    }

    // [CHANGED] Sort by YYYY-MM key ascending (chronological)
    const trends = Object.entries(trendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, t]) => ({
        month     : t.month,
        present   : t.present,
        total     : t.total,
        absent    : t.total - t.present,
        percentage: t.total ? +((t.present / t.total) * 100).toFixed(1) : null,
      }));

    // [CHANGED] Include a simple overall summary for the requested period
    const periodTotal   = trends.reduce((s, t) => s + t.total,   0);
    const periodPresent = trends.reduce((s, t) => s + t.present, 0);

    res.json({
      trends,
      period: {
        months     : monthsBack,
        total      : periodTotal,
        present    : periodPresent,
        percentage : periodTotal ? +((periodPresent / periodTotal) * 100).toFixed(1) : null,
      },
    });

  } catch (err) {
    console.error('[getMonthlyTrends]', err);
    res.status(500).json({ message: 'Failed to fetch monthly trends.' });
  }
};
 
 // 🔔 Mark attendance from notification
exports.markFromNotification = async (req, res) => {
  try {
    const { subjectId, status, date } = req.body;
    const userId = req.user.id || req.user._id;

    // Map notification status → your system status
    const statusMap = {
      attended: 'present',
      not_attended: 'absent',
      not_held: 'cancelled'
    };

    const mappedStatus = statusMap[status];

    if (!subjectId || !mappedStatus) {
      return res.status(400).json({ message: 'Invalid subjectId or status' });
    }

    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setHours(0, 0, 0, 0);

    // 🔒 Ensure subject belongs to user (same as your existing logic)
   const mongoose = require('mongoose');
const isValidId = mongoose.Types.ObjectId.isValid(subjectId);
const subject = isValidId
  ? await Subject.findOne({ $or: [{ _id: subjectId }, { name: subjectId }], userId })
  : await Subject.findOne({ name: subjectId, userId });
if (!subject) {
  return res.status(404).json({ message: 'Subject not found' });
}

    const record = await Attendance.findOneAndUpdate(
      { userId, subjectId, date: attendanceDate },
      {
        userId,
        subjectId,
        status: mappedStatus,
        date: attendanceDate,
        markedAt: new Date()
      },
      { upsert: true, new: true }
    );

    console.log(`🔔 Attendance marked via notification: ${mappedStatus}`);

    res.json({ success: true, record });

  } catch (err) {
    console.error('[markFromNotification]', err);
    res.status(500).json({ message: 'Failed to mark attendance from notification' });
  }
};

// GET /api/attendance/student/:sid  (teacher views a student's attendance)
exports.getStudentBySid = async (req, res) => {
  try {
    const student = await User.findOne({ sid: req.params.sid });
    if (!student)
      return res.status(404).json({ message: `No student found with SID: ${req.params.sid}` });

    const rawRecords = await Attendance.find({ userId: student._id })
      .populate('subjectId', 'name code')
      .sort({ date: -1 });

    // Flatten records for the table
    const records = rawRecords.map(r => ({
      date:    r.date,
      status:  r.status,
      subject: r.subjectId?.name || 'Unknown',
      code:    r.subjectId?.code || '—',
    }));

    // Per-subject summary for the breakdown bars
    const subjectMap = {};
    for (const r of rawRecords) {
      if (r.status === 'cancelled') continue;
      const key  = r.subjectId?._id?.toString() || 'unknown';
      const name = r.subjectId?.name || 'Unknown';
      const code = r.subjectId?.code || '—';
      if (!subjectMap[key]) subjectMap[key] = { subject: name, code, present: 0, total: 0 };
      subjectMap[key].total++;
      if (r.status === 'present') subjectMap[key].present++;
    }

    const summary = Object.values(subjectMap).map(s => ({
      ...s,
      percentage: s.total ? +((s.present / s.total) * 100).toFixed(1) : 0,
    }));

    const present = records.filter(r => r.status === 'present').length;
    const absent  = records.filter(r => r.status === 'absent').length;
    const total   = present + absent;

    res.json({
      student: { name: student.name, email: student.email, sid: student.sid },
      records,
      summary,
      total,
      present,
      absent,
    });
  } catch (err) {
    console.error('[getStudentBySid]', err);
    res.status(500).json({ message: 'Failed to fetch student attendance.' });
  }
};

