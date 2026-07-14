// controllers/attendanceUploadController.js
const XLSX      = require('xlsx');
const mongoose  = require('mongoose');
const axios     = require('axios');
const dns       = require('dns').promises;
const net       = require('net');
const User      = require('../models/User');
const Attendance = require('../models/Attendance');

// ─── SSRF guard: only allow fetching public http(s) hosts ────────────────────
// Prevents a teacher-supplied "import from URL" link from being used to reach
// internal services, cloud metadata endpoints (e.g. 169.254.169.254), or
// loopback addresses from the server.
function isPrivateOrReservedIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 127) return true;                       // loopback
    if (a === 10) return true;                         // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
    if (a === 192 && b === 168) return true;            // 192.168.0.0/16
    if (a === 169 && b === 254) return true;            // link-local / cloud metadata
    if (a === 0) return true;                           // 0.0.0.0/8
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;                     // loopback
  if (lower.startsWith('fe80:')) return true;           // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local fc00::/7
  if (lower.startsWith('::ffff:')) return isPrivateOrReservedIp(lower.slice(7));
  return false;
}

async function assertPublicHttpUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http:// and https:// URLs are allowed.');
  }
  const hostname = parsed.hostname;
  if (!hostname || hostname === 'localhost') {
    throw new Error('This URL is not allowed.');
  }

  const ips = net.isIP(hostname)
    ? [hostname]
    : (await dns.lookup(hostname, { all: true })).map(r => r.address);

  if (!ips.length || ips.some(isPrivateOrReservedIp)) {
    throw new Error('This URL points to a private or internal address and is not allowed.');
  }
}

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
  if (s === 'present' || s === 'p') return 'present';
  if (s === 'absent' || s === 'a')  return 'absent';
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ─── Helper: Process Excel buffer and record attendance ──────────────────────
const processExcelBuffer = async (buffer) => {
  const workbook  = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet     = workbook.Sheets[sheetName];
  const rows      = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rows.length) {
    throw new Error('Excel file is empty.');
  }

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

  // ── Upsert valid records ──
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

    if (result.lastErrorObject?.updatedExisting) {
      updated++;
    } else {
      inserted++;
    }
  }

  return {
    inserted,
    updated,
    skipped: errors.length,
    errors,
  };
};

// ─── Helper: Follow redirects and resolve direct download url for OneDrive ───
function parseCookies(cookieHeaders) {
  if (!cookieHeaders) return {};
  const cookies = {};
  cookieHeaders.forEach(header => {
    const parts = header.split(';');
    const mainPart = parts[0];
    const eqIdx = mainPart.indexOf('=');
    if (eqIdx > -1) {
      const key = mainPart.slice(0, eqIdx).trim();
      const val = mainPart.slice(eqIdx + 1).trim();
      cookies[key] = val;
    }
  });
  return cookies;
}

function serializeCookies(cookieMap) {
  return Object.entries(cookieMap)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function resolveOneDriveLink(shareUrl) {
  let currentUrl = shareUrl;
  let cookieMap = {};

  for (let i = 0; i < 5; i++) {
    await assertPublicHttpUrl(currentUrl);

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    const cookieStr = serializeCookies(cookieMap);
    if (cookieStr) {
      headers['Cookie'] = cookieStr;
    }

    const res = await axios.get(currentUrl, {
      maxRedirects: 0,
      validateStatus: () => true,
      headers: headers
    });

    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      const newCookies = parseCookies(setCookie);
      cookieMap = { ...cookieMap, ...newCookies };
    }

    if (!res.headers.location) {
      const html = res.data;
      const match = html.match(/"FileGetUrl"\s*:\s*"([^"]+)"/);
      if (match) {
        return match[1].replace(/\\u0026/g, '&');
      }

      const matchFallback = html.match(/https?:\/\/[^\s"'`<>]+download\.aspx\?[^\s"'`<>\\]+(?:\\u0026[^\s"'`<>\\]+)+/gi);
      if (matchFallback && matchFallback.length > 0) {
        return matchFallback[0].replace(/\\u0026/g, '&');
      }

      throw new Error('Could not find download URL in the OneDrive page HTML.');
    }

    currentUrl = new URL(res.headers.location, currentUrl).toString();
  }
  throw new Error('Too many redirects without reaching target page.');
}

async function downloadExcelFromUrl(url) {
  await assertPublicHttpUrl(url);

  let downloadUrl = url;
  if (/1drv\.ms/i.test(url) || /onedrive\.live\.com/i.test(url)) {
    downloadUrl = await resolveOneDriveLink(url);
  }

  await assertPublicHttpUrl(downloadUrl);

  const res = await axios.get(downloadUrl, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  return res.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/attendance/upload
// Teacher only — upload Excel file for bulk attendance
// ─────────────────────────────────────────────────────────────────────────────
const uploadBulkAttendance = async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Only teachers can upload attendance.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const result = await processExcelBuffer(req.file.buffer);
    return res.status(200).json({
      message: 'Bulk attendance upload complete.',
      ...result,
    });
  } catch (err) {
    console.error('[uploadBulkAttendance]', err.message);
    return res.status(500).json({ message: 'Server error during upload.', error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/attendance/upload-url
// Teacher only — download Excel file from URL and process bulk attendance
// ─────────────────────────────────────────────────────────────────────────────
const uploadBulkAttendanceFromUrl = async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Only teachers can upload attendance.' });
    }

    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ message: 'URL link is required.' });
    }

    console.log(`[uploadBulkAttendanceFromUrl] Downloading Excel from URL: ${url}`);
    const buffer = await downloadExcelFromUrl(url);
    const result = await processExcelBuffer(buffer);

    return res.status(200).json({
      message: 'Bulk attendance upload from URL complete.',
      ...result,
    });
  } catch (err) {
    console.error('[uploadBulkAttendanceFromUrl]', err.message);
    return res.status(500).json({ message: 'Failed to download or process Excel file from link.', error: err.message });
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

    // Only the student themselves or a teacher may view this attendance record
    const requesterId = String(req.user.id || req.user._id || '');
    const isSelf = String(user._id) === requesterId;
    if (!isSelf && req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'You are not authorized to view this student\'s attendance.' });
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
        date:      r.date,
        status:    r.status,
        subject:   r.subjectId?.name || 'Unknown',
        code:      r.subjectId?.code || '',
        subjectId: r.subjectId?._id?.toString() || null,
        slot:      r.slot || null,
        time:      r.time || null,
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
  uploadBulkAttendanceFromUrl,
  getAttendanceBySid,
  getClassSummary,
  downloadTemplate,
  // Exported for unit tests:
  isPrivateOrReservedIp,
  assertPublicHttpUrl,
};