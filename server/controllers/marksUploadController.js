// ============================================================
//  marksUploadController.js
//  Smart Marks Processing Engine
//  Handles ANY PDF format → dynamic column detection → ranking
// ============================================================

const pdfParse   = require('pdf-parse');
const { PdfReader } = require('pdfreader');
const XLSX       = require('xlsx');
const { detectColumns } = require('../services/columnDetector');
// ─────────────────────────────────────────────────────────────
//  STEP 1 — PDF → rawRows
//  Strategy:
//    1. pdfreader  (table-aware, row/col positioning)
//    2. pdf-parse  (fallback — raw text, regex-based)
//    3. tesseract  (last resort — scanned image PDF)
// ─────────────────────────────────────────────────────────────

/**
 * pdfreader strategy — groups tokens by Y-position into rows,
 * then by X-position into cells. Works well for real tables.
 */
function extractWithPdfReader(buffer) {
  return new Promise((resolve, reject) => {
    const rowMap = {};   // { yKey: [ {x, text} ] }

    new PdfReader().parseBuffer(buffer, (err, item) => {
      if (err) return reject(err);

      if (!item) {
        // EOF — convert rowMap → sorted rows of strings
        const rows = Object.keys(rowMap)
          .map(Number)
          .sort((a, b) => a - b)
          .map(y =>
            rowMap[y]
              .sort((a, b) => a.x - b.x)
              .map(c => c.text.trim())
              .filter(Boolean)
          )
          .filter(r => r.length > 0);
        return resolve(rows);
      }

      if (item.text) {
        // Round Y to 1 decimal to group tokens on the same line
        const yKey = Math.round(item.y * 2) / 2;
        if (!rowMap[yKey]) rowMap[yKey] = [];
        rowMap[yKey].push({ x: item.x, text: item.text });
      }
    });
  });
}

/**
 * pdf-parse strategy — raw text split into lines → split by
 * 2+ spaces or tab characters into cells.
 */
async function extractWithPdfParse(buffer) {
  const data  = await pdfParse(buffer);
  const lines = data.text.split('\n').map(l => l.trim()).filter(Boolean);

  return lines.map(line =>
    line.split(/\s{2,}|\t/).map(c => c.trim()).filter(Boolean)
  ).filter(r => r.length > 1);   // skip single-token lines
}

/**
 * tesseract strategy — for scanned / image PDFs.
 * Requires tesseract.js (already in package.json).
 */
async function extractWithTesseract(buffer) {
  const Tesseract = require('tesseract.js');
  const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.map(line =>
    line.split(/\s{2,}|\t/).map(c => c.trim()).filter(Boolean)
  ).filter(r => r.length > 1);
}

/**
 * Master extractor — tries strategies in order, returns the
 * result with the most rows (= most likely to be correct).
 */
async function extractRawRows(buffer) {
  const results = [];

  try {
    const rows = await extractWithPdfReader(buffer);
    if (rows.length > 2) results.push({ method: 'pdfreader', rows });
  } catch (_) { /* silent fallback */ }

  try {
    const rows = await extractWithPdfParse(buffer);
    if (rows.length > 2) results.push({ method: 'pdf-parse', rows });
  } catch (_) { /* silent fallback */ }

  if (results.length === 0) {
    // Last resort: OCR
    try {
      const rows = await extractWithTesseract(buffer);
      results.push({ method: 'tesseract', rows });
    } catch (err) {
      throw new Error('All PDF extraction methods failed: ' + err.message);
    }
  }

  // Pick the result with the most rows
  results.sort((a, b) => b.rows.length - a.rows.length);
  return results[0];
}

// ─────────────────────────────────────────────────────────────
//  STEP 2 — rawRows → detectSchema
//  Identifies: headerRow, nameCol, rollCol, marksCols[]
// ─────────────────────────────────────────────────────────────

const NAME_HINTS = ['name', 'student', 'candidate', 'स्टूडेंट'];
const ROLL_HINTS = ['roll', 'id', 'enroll', 'reg', 'no', 'number', 'sap', 'uid'];

function looksNumeric(val) {
  if (!val) return false;
  // Accept "18", "18.5", "18/20", "A", "AB" (absent), "-"
  return /^[\d.]+$/.test(val) || /^\d+\/\d+$/.test(val) || /^[Aa][Bb]?$/.test(val) || val === '-';
}

function parseNumeric(val, max) {
  if (!val || val === '-') return 0;
  if (/^[Aa][Bb]?$/.test(val)) return 0;   // absent
  if (/^\d+\/\d+$/.test(val)) {
    const [n, d] = val.split('/').map(Number);
    return d > 0 ? (n / d) * max : 0;
  }
  return parseFloat(val) || 0;
}

/**
 * Find the header row — row where most cells look like labels
 * (non-numeric, short text).
 */
const HEADER_KEYWORDS = [
  'name', 'roll', 'id', 'enroll', 'reg', 'total', 'marks', 'score',
  'exam', 'quiz', 'mid', 'sem', 'tq', 'lq', 'mt', 'ct', 'cia',
  'subject', 'max', 'out', 'obtained', 'sap', 'uid', 'no', 'sr'
];

function findHeaderRow(rows) {
  let bestScore = -1;
  let bestIdx   = 0;

  rows.forEach((row, i) => {
    if (i > 15) return;
    const lowerRow = row.map(c => c.toLowerCase().trim());
    const allNumeric = lowerRow.every(c => looksNumeric(c));
    if (allNumeric) return;
    const keywordMatches = lowerRow.filter(cell =>
      HEADER_KEYWORDS.some(kw => cell.includes(kw))
    ).length;
    const avgLen = row.reduce((s, c) => s + c.length, 0) / (row.length || 1);
    const brevityBonus = avgLen < 15 ? 0.3 : 0;
    const score = keywordMatches + brevityBonus;
    if (score > bestScore) {
      bestScore = score;
      bestIdx   = i;
    }
  });

  return bestScore <= 0 ? 0 : bestIdx;
}

/**
 * Detect column schema from the header row.
 * Returns:
 *   { headerIdx, nameCol, rollCol, marksCols: [{idx, label}] }
 */
function detectSchema(rows) {
  const headerIdx = findHeaderRow(rows);
  const header    = rows[headerIdx].map(h => h.toLowerCase().trim());

  let nameCol = -1;
  let rollCol = -1;
  const marksCols = [];

  header.forEach((h, i) => {
    if (nameCol === -1 && NAME_HINTS.some(hint => h.includes(hint))) {
      nameCol = i;
    } else if (rollCol === -1 && ROLL_HINTS.some(hint => h.includes(hint))) {
      rollCol = i;
    } else if (h.length > 0 && !looksNumeric(rows[headerIdx][i])) {
      marksCols.push({ idx: i, label: rows[headerIdx][i] });
    }
  });

  // Fallback: if no name column found, assume col 0
  if (nameCol === -1) nameCol = 0;

  // Fallback: if no marks cols found, every column except name/roll
  if (marksCols.length === 0) {
    header.forEach((_, i) => {
      if (i !== nameCol && i !== rollCol) {
        marksCols.push({ idx: i, label: rows[headerIdx][i] || `Col${i}` });
      }
    });
  }

  return { headerIdx, nameCol, rollCol, marksCols };
}

/**
 * Infer maximum marks for each column by scanning data rows
 * and taking the highest numeric value seen.
 */
function inferMaxMarks(rows, schema) {
  const { headerIdx, marksCols } = schema;
  const dataRows = rows.slice(headerIdx + 1);
  const maxMap   = {};

  marksCols.forEach(col => {
    let colMax = 0;
    dataRows.forEach(row => {
      const val = row[col.idx];
      if (!val) return;
      // "18/20" → max is 20
      if (/^\d+\/\d+$/.test(val)) {
        const d = parseInt(val.split('/')[1]);
        if (d > colMax) colMax = d;
      } else if (/^[\d.]+$/.test(val)) {
        const n = parseFloat(val);
        if (n > colMax) colMax = n;
      }
    });
    maxMap[col.label] = colMax || 100;   // default 100 if undetermined
  });

  return maxMap;
}

// ─────────────────────────────────────────────────────────────
//  STEP 3 — Build student records from rows + schema
// ─────────────────────────────────────────────────────────────

/**
 * Merge orphan rows — when a student name wraps to one line and
 * their marks appear on the next line (common in dense PDFs),
 * stitch them together before building records.
 */
function mergeOrphanRows(rows, headerIdx) {
  const dataRows = rows.slice(headerIdx + 1);
  const merged   = [];

  dataRows.forEach(row => {
    if (!row || row.length === 0) return;

    const first = row[0]?.trim() || '';

    // An orphan row: starts with a numeric serial OR all cells are numeric/marks
    const isOrphan = looksNumeric(first) && merged.length > 0 &&
                     row.every(c => looksNumeric(c) || !c.trim());

    if (isOrphan) {
      // Append cells to the previous row
      const prev = merged[merged.length - 1];
      row.forEach(cell => {
        if (cell?.trim()) prev.push(cell.trim());
      });
    } else {
      merged.push([...row]);
    }
  });

  return merged;
}

function buildStudentRecords(rows, schema) {
  const { headerIdx, nameCol, rollCol, marksCols } = schema;

  // Merge split rows before processing
  const dataRows = mergeOrphanRows(rows, headerIdx);
  const students = [];

  dataRows.forEach(row => {
    if (!row || row.length === 0) return;

    const name = row[nameCol]?.trim();
    if (!name || name.length < 2) return;
    if (looksNumeric(name)) return;

    const roll     = rollCol !== -1 ? (row[rollCol]?.trim() || '') : '';
    const rawMarks = {};

    marksCols.forEach(col => {
      rawMarks[col.label] = row[col.idx]?.trim() || '';
    });

    students.push({ name, roll, rawMarks });
  });

  return students;
}

// ─────────────────────────────────────────────────────────────
//  STEP 4 — Weight calculator
//  (obtained / originalMax) * newWeight = normalizedScore
// ─────────────────────────────────────────────────────────────

function applyWeights(students, selectedColumns, originalMaxMap, weightConfig) {
  return students.map(student => {
    let total = 0;
    const breakdown = {};

    selectedColumns.forEach(colLabel => {
      const originalMax  = originalMaxMap[colLabel] || 100;
      const newWeight    = weightConfig[colLabel]   ?? originalMax;
      const rawVal       = student.rawMarks[colLabel] || '0';
      const obtained     = parseNumeric(rawVal, originalMax);
      const normalized   = originalMax > 0
        ? (obtained / originalMax) * newWeight
        : 0;

      breakdown[colLabel] = {
        raw:        rawVal,
        obtained:   +obtained.toFixed(2),
        outOf:      originalMax,
        weight:     newWeight,
        normalized: +normalized.toFixed(2),
      };

      total += normalized;
    });

    return {
      name:      student.name,
      roll:      student.roll,
      total:     +total.toFixed(2),
      breakdown,
    };
  });
}

// ─────────────────────────────────────────────────────────────
//  STEP 5 — Ranking service
//  Handles ties: students with same total get the same rank,
//  next rank skips (standard competition ranking).
// ─────────────────────────────────────────────────────────────

function rankStudents(scoredStudents) {
  const sorted = [...scoredStudents].sort((a, b) => b.total - a.total);

  let rank         = 1;
  let prevTotal    = null;
  let sameRankCount = 0;

  return sorted.map((student, i) => {
    if (student.total !== prevTotal) {
      rank      = i + 1;
      sameRankCount = 0;
    } else {
      sameRankCount++;
    }
    prevTotal = student.total;
    return { rank, ...student };
  });
}

// ─────────────────────────────────────────────────────────────
//  EXCEL EXPORT HELPER
// ─────────────────────────────────────────────────────────────

function generateExcel(leaderboard, selectedColumns) {
  const rows = leaderboard.map(s => {
    const row = {
      Rank: s.rank,
      Name: s.name,
      Roll: s.roll || 'N/A',
    };
    selectedColumns.forEach(col => {
      const b = s.breakdown[col];
      row[`${col} (raw)`]        = b?.raw        ?? '';
      row[`${col} (normalized)`] = b?.normalized ?? '';
    });
    row['Total Score'] = s.total;
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leaderboard');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ─────────────────────────────────────────────────────────────
//  ROUTE HANDLERS
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/marks/upload-pdf
 * Body: multipart/form-data, field: "file" (PDF)
 *
 * Response:
 * {
 *   columns:    [{ label, inferredMax }],
 *   students:   [{ name, roll, rawMarks }],
 *   method:     'pdfreader' | 'pdf-parse' | 'tesseract'
 * }
 */
exports.uploadPdf = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Send a PDF as field "file".' });
    }

    const buffer = req.file.buffer;

    // ── Step 1: Extract rows ──────────────────────────────
    const { method, rows } = await extractRawRows(buffer);

    if (!rows || rows.length < 2) {
      return res.status(422).json({
        message: 'Could not extract tabular data from this PDF. ' +
                 'Ensure it contains a table with student names and marks.',
      });
    }

    // ── Step 2: Convert rows → objects using header row ───
    const schema    = detectSchema(rows);
    const headerRow = rows[schema.headerIdx];
    const dataRows  = rows.slice(schema.headerIdx + 1);

    const rawObjects = dataRows
      .filter(r => r.length > 1)
      .map(row => {
        const obj = {};
        headerRow.forEach((key, i) => { obj[key] = row[i] ?? ''; });
        return obj;
      });

    // ── Step 3: Smart column detection ───────────────────
    const { columns, studentRows } = detectColumns(rawObjects);

    if (!columns.length) {
      return res.status(422).json({ message: 'No marks columns detected. PDF must have at least one numeric column.' });
    }
    if (!studentRows.length) {
      return res.status(422).json({ message: 'No student records found in the PDF.' });
    }

    // ── Step 4: Reshape marks → rawMarks for rankMarks ───
    const shaped = studentRows.map(s => ({
      name:     s.name,
      roll:     s.roll,
      rawMarks: s.marks,
    }));

    res.json({ method, columns, studentRows: shaped });

  } catch (err) {
    console.error('[uploadPdf]', err);
    res.status(500).json({ message: 'PDF processing failed: ' + err.message });
  }
};
/**
 * POST /api/marks/rank
 * Body (JSON):
 * {
 *   students:        [{ name, roll, rawMarks }],    ← from uploadPdf
 *   selectedColumns: ['MidSem', 'Quiz1'],
 *   originalMax:     { MidSem: 30, Quiz1: 10 },
 *   weights:         { MidSem: 20, Quiz1: 10 },     ← optional overrides
 *   exportExcel:     true | false
 * }
 *
 * Response:
 *   JSON leaderboard  OR  Excel file download
 */
exports.rankMarks = async (req, res) => {
  try {
    const {
      students,
      selectedColumns,
      originalMax  = {},
      weights      = {},
      exportExcel  = false,
    } = req.body;

    // ── Validate ──────────────────────────────────────────
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: '"students" array is required.' });
    }
    if (!Array.isArray(selectedColumns) || selectedColumns.length === 0) {
      return res.status(400).json({ message: '"selectedColumns" array is required.' });
    }

    // ── Step 4: Apply weights ─────────────────────────────
    const scored = applyWeights(students, selectedColumns, originalMax, weights);

    // ── Step 5: Rank ──────────────────────────────────────
    const leaderboard = rankStudents(scored);

    // ── Excel export ──────────────────────────────────────
    if (exportExcel) {
      const buffer = generateExcel(leaderboard, selectedColumns);
      res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="leaderboard.xlsx"');
      return res.send(buffer);
    }

    res.json({ leaderboard });

  } catch (err) {
    console.error('[rankMarks]', err);
    res.status(500).json({ message: 'Ranking failed: ' + err.message });
  }
};