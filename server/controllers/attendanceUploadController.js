// controllers/attendanceUploadController.js
const XLSX      = require('xlsx');
const mongoose  = require('mongoose');
const User      = require('../models/User');
const Attendance = require('../models/Attendance');

// ─── Helper: parse & validate date string ────────────────────────────────────
function parseDate(raw) {
  if (!raw) return null;

  // Handle Excel serial date numbers
  if (typeof raw === 'number') {
    const date = XLSX.SSF.parse_date_code(raw);
    if (!date) return null;
    return new Date(date.y, date.m - 1, date.d);
  }

  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Helper: normalize status ────────────────────────────────────────────────
function normalizeStatus(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (s === 'present') return 'present';
  if (s === 'absent')  return 'absent';
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/attendance/upload
// Teacher only — upload Excel file for bulk attendance
// ─────────────────────────────────────────────────────────────────────────────
const uploadBulkAttendance = async (req, res) => {
  try {
    // ── 1. Role check ──────────────────────────────────────────────────────
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Only teachers can upload attendance.' });
    }

    // ── 2. File check ──────────────────────────────────────────────────────
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    // ── 3. Parse Excel ─────────────────────────────────────────────────────
    const workbook  = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet     = workbook.Sheets[sheetName];
    const rows      = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) {
      return res.status(400).json({ message: 'Excel file is empty.' });
    }

    // ── 4. Process rows ────────────────────────────────────────────────────
    const errors   = [];
    const ops      = []; // valid upsert operations
    let inserted   = 0;
    let updated    = 0;

    for (let i = 0; i < rows.length; i++) {
      const row     = rows[i];
      const rowNum  = i + 2; // Excel row number (1 = header)

      const sid     = String(row['SID']     || '').trim();
      const subject = String(row['Subject'] || '').trim();
      const rawDate = row['Date'];
      const rawStatus = row['Status'];

      // ── Validate SID ──
      if (!sid) {
        errors.push({ row: rowNum, reason: 'SID is missing' });
        continue;
      }

      // ── Validate Date ──
      const date = parseDate(rawDate);
      if (!date) {
        errors.push({ row: rowNum, sid, reason: 'Invalid or missing Date' });
        continue;
      }

      // ── Validate Status ──
      const status = normalizeStatus(rawStatus);
      if (!status) {
        errors.push({ row: rowNum, sid, reason: `Invalid status "${rawStatus}" — must be Present or Absent` });
        continue;
      }

      // ── Look up user by SID ──
      const user = await User.findOne({ sid }).select('_id');
      if (!user) {
        errors.push({ row: rowNum, sid, reason: `No user found with SID "${sid}"` });
        continue;
      }

      // ── Look up subject by name (case-insensitive) ──
      // We use the Subject model if it exists, else store subject as string
      let subjectId = null;
      if (subject) {
        try {
          const Subject = require('../models/Subject');
         const subjectDoc = await Subject.findOne({
            name: { $regex: new RegExp(`^${subject}$`, 'i') },
          }).select('_id userId');

          if (!subjectDoc) {
            errors.push({ row: rowNum, sid, reason: `Subject "${subject}" not found in database` });
            continue;
          }
          subjectId = subjectDoc._id;
        } catch {
          // Subject model doesn't exist — skip subject lookup
          errors.push({ row: rowNum, sid, reason: 'Subject model not available' });
          continue;
        }
      } else {
        errors.push({ row: rowNum, sid, reason: 'Subject is required' });
        continue;
      }

      // ── Normalize date to midnight UTC ──
      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);

      ops.push({
        userId:    user._id,
        subjectId,
        date:      normalizedDate,
        status,
      });
    }

    // ── 5. Upsert valid records ────────────────────────────────────────────
    for (const op of ops) {
      const filter = {
        userId:    op.userId,
        subjectId: op.subjectId,
        date:      op.date,
      };

      const result = await Attendance.findOneAndUpdate(
        filter,
        { $set: { status: op.status } },
        { upsert: true, new: true, rawResult: true }
      );

      // rawResult.lastErrorObject.updatedExisting = true means it was updated
      if (result.lastErrorObject?.updatedExisting) {
        updated++;
      } else {
        inserted++;
      }
    }

    // ── 6. Response ───────────────────────────────────────────────────────
    return res.status(200).json({
      message:  'Bulk attendance upload complete.',
      inserted,
      updated,
      skipped:  errors.length,
      errors,
    });

  } catch (err) {
    console.error('[uploadBulkAttendance]', err.message);
    return res.status(500).json({ message: 'Server error during upload.', error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attendance/student/:sid
// Fetch attendance for a student by SID — sorted latest first
// ─────────────────────────────────────────────────────────────────────────────
const getAttendanceBySid = async (req, res) => {
  try {
    const { sid } = req.params;

    // Find user by SID
    const user = await User.findOne({ sid }).select('_id name email');
    if (!user) {
      return res.status(404).json({ message: `No user found with SID "${sid}"` });
    }

    // Fetch attendance records
    const records = await Attendance.find({ userId: user._id })
      .populate('subjectId', 'name code')
      .sort({ date: -1 });

    // Calculate percentage per subject
    const subjectMap = {};
    for (const r of records) {
      const key = r.subjectId?._id?.toString() || 'unknown';
      if (!subjectMap[key]) {
        subjectMap[key] = {
          subject: r.subjectId?.name || 'Unknown',
          code:    r.subjectId?.code || '',
          total:   0,
          present: 0,
        };
      }
      subjectMap[key].total++;
      if (r.status === 'present') subjectMap[key].present++;
    }

    const summary = Object.values(subjectMap).map(s => ({
      ...s,
      percentage: s.total ? Math.round((s.present / s.total) * 100) : 0,
    }));

    return res.status(200).json({
      student: { name: user.name, email: user.email, sid },
      total:   records.length,
      summary,
      records: records.map(r => ({
        date:    r.date,
        status:  r.status,
        subject: r.subjectId?.name || 'Unknown',
        code:    r.subjectId?.code || '',
      })),
    });

  } catch (err) {
    console.error('[getAttendanceBySid]', err.message);
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attendance/template
// Download a sample Excel template
// ─────────────────────────────────────────────────────────────────────────────
const downloadTemplate = (_req, res) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['SID', 'Date', 'Status', 'Subject'],
    ['S101', '2026-04-10', 'Present', 'DBMS'],
    ['S102', '2026-04-10', 'Absent',  'DBMS'],
    ['S103', '2026-04-10', 'Present', 'DBMS'],
  ]);

  // Set column widths
  ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename=attendance_template.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attendance/class-summary
// Teacher only — returns per-student attendance % per subject
// ─────────────────────────────────────────────────────────────────────────────
const getClassSummary = async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Only teachers can view class summary.' });
    }

    // Get all attendance records with user + subject populated
    const records = await Attendance.find()
      .populate('userId',    'name email sid')
      .populate('subjectId', 'name code')
      .lean();

    // Build map: studentId → { student info, subjects: { subjectId → stats } }
    const studentMap = {};

    for (const r of records) {
      if (!r.userId || !r.subjectId) continue;

      const uid = r.userId._id.toString();
      if (!studentMap[uid]) {
        studentMap[uid] = {
          name    : r.userId.name,
          email   : r.userId.email,
          sid     : r.userId.sid || '—',
          subjects: {},
        };
      }

      const subKey = r.subjectId._id.toString();
      if (!studentMap[uid].subjects[subKey]) {
        studentMap[uid].subjects[subKey] = {
          subject: r.subjectId.name,
          code   : r.subjectId.code,
          total  : 0,
          present: 0,
        };
      }

      if (r.status !== 'cancelled') {
        studentMap[uid].subjects[subKey].total++;
        if (r.status === 'present') studentMap[uid].subjects[subKey].present++;
      }
    }

    // Format response
    const students = Object.values(studentMap).map(s => ({
      name    : s.name,
      email   : s.email,
      sid     : s.sid,
      subjects: Object.values(s.subjects).map(sub => ({
        subject   : sub.subject,
        code      : sub.code,
        present   : sub.present,
        total     : sub.total,
        percentage: sub.total ? Math.round((sub.present / sub.total) * 100) : 0,
      })),
      overall: (() => {
        const subs = Object.values(s.subjects);
        const total   = subs.reduce((a, b) => a + b.total,   0);
        const present = subs.reduce((a, b) => a + b.present, 0);
        return total ? Math.round((present / total) * 100) : 0;
      })(),
    }));

    // Sort by name
    students.sort((a, b) => a.name.localeCompare(b.name));

    res.json({ students, total: students.length });

  } catch (err) {
    console.error('[getClassSummary]', err.message);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

module.exports = {
  uploadBulkAttendance,
  getAttendanceBySid,
  getClassSummary,
  downloadTemplate,
};