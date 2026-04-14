/**
 * columnDetector.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Dynamically detects mark-columns from ANY parsed PDF table.
 * Works on top of already-extracted raw rows — does NOT touch the PDF pipeline.
 *
 * EXPORTS
 *   detectColumns(rawRows)      → { columns, studentRows }
 *   parseMarkValue(val)         → number   (handles "Ab", null, "8/10", …)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Keys that are NEVER mark-columns regardless of what the PDF calls them
const NON_MARK_KEYS = new Set([
  's.no', 'sno', 'sr', 'sr.no', 'sr. no', 'sr. no.', 'serial', 'sl', 'sl.no', 'no', 'no.',
  'name', 'student', 'student name', 'studentname',
  'roll', 'roll no', 'rollno', 'roll number', 'enrollment',
  'reg', 'reg no', 'regno', 'registration',
  'remark', 'remarks', 'grade', 'result', 'status', 'comment',
 'grand total', 'grandtotal',
  'sid', 'uid', 'sap', 'sap id', 'sapid', 'id',
  'section', 'batch', 'branch', 'dept', 'department',
  'father', 'email', 'phone', 'mobile', 'dob', 'gender',
]);

/**
 * Normalise a header string for comparison.
 * "Quiz 1 (10)" → "quiz 1 (10)"
 */
const norm = s => String(s ?? '').trim().toLowerCase();

/**
 * Try to extract the max-marks number from a header like:
 *   "Quiz1(10)"  →  10
 *   "MidSem (30)" → 30
 *   "Assignment[20]" → 20
 * Returns null if not found.
 */
function extractMax(header) {
  const bracketMatch = String(header).match(/[(\[]\s*(\d+(?:\.\d+)?)\s*[)\]]/);
  if (bracketMatch) return parseFloat(bracketMatch[1]);
  const slashMatch = String(header).match(/\/\s*(\d+(?:\.\d+)?)\s*$/);
  if (slashMatch) return parseFloat(slashMatch[1]);
  return null;
}

/**
 * Strip the "(max)" part from a header to get a clean display name.
 * "Quiz1(10)" → "Quiz1"
 */
function cleanName(header) {
  return String(header)
    .replace(/[(\[]\s*\d+(?:\.\d+)?\s*[)\]]/g, '')
    .replace(/\/\s*\d+(?:\.\d+)?\s*$/g, '')
    .trim();
}

/**
 * Parse a raw cell value into a number.
 *
 *   "Ab" / "A" / "Absent" / "-" / "—" / "" / null / undefined → 0
 *   "8.5"    → 8.5
 *   "8/10"   → 8      (takes the numerator; denominator ignored here)
 *   " 07 "   → 7
 */
function parseMarkValue(val) {
  if (val === null || val === undefined) return 0;
  const s = String(val).trim();
  if (!s) return 0;
  if (/^(ab|absent|a|-|—|n\/a|na|nd|not\s*done)$/i.test(s)) return 0;

  // "8/10" → take numerator
  const slashMatch = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*\d/);
  if (slashMatch) return parseFloat(slashMatch[1]);

  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

/**
 * Infer the max mark for a column when no "(max)" annotation exists.
 * Strategy: take the highest numeric value seen in that column across all rows.
 * Falls back to 100 if no data.
 */
function inferMax(values) {
  const nums = values.map(parseMarkValue).filter(n => n > 0);
  if (!nums.length) return 100;
  return Math.max(...nums);
}

/**
 * Main function.
 *
 * @param {Array<Object>} rawRows
 *   Each element is a plain object whose keys are the PDF column headers
 *   and values are the raw cell strings, e.g.:
 *   [
 *     { "S.No": "1", "Name": "Anmol", "Roll": "101", "Quiz1(10)": "8", "MidSem(30)": "22" },
 *     …
 *   ]
 *
 * @returns {{
 *   columns: Array<{ name: string, originalHeader: string, max: number }>,
 *   studentRows: Array<{ name: string, roll: string, marks: Object }>
 * }}
 */
function detectColumns(rawRows) {
  if (!rawRows || !rawRows.length) return { columns: [], studentRows: [] };

  // ── 1. Collect all headers from first row ──────────────────────────────────
  const allHeaders = Object.keys(rawRows[0]);

  // ── 2. Identify name / roll / serial columns ───────────────────────────────
  let nameKey  = null;
  let rollKey  = null;

  for (const h of allHeaders) {
    const n = norm(h);
    if (!nameKey && (n === 'name' || n === 'student name' || n === 'studentname' || n === 'student')) {
      nameKey = h;
    }
    if (!rollKey && (n === 'roll' || n === 'roll no' || n === 'rollno' || n === 'roll number' ||
        n === 'enrollment' || n === 'reg no' || n === 'regno' ||
        n === 'sid' || n === 'uid' || n === 'sap' || n === 'sap id' || n === 'id')) {
      rollKey = h;
    }
  }

  // Fallback: if no explicit "Name" column, try the second column (index 1)
 if (!nameKey) {
    nameKey = allHeaders.find(h => {
      const n = norm(h);
      return !NON_MARK_KEYS.has(n) && !/^\d+$/.test(String(rawRows[0]?.[h] ?? ''));
    }) ?? allHeaders[1] ?? allHeaders[0];
  }

  // ── 3. Identify mark-columns (everything that is NOT name/roll/serial) ─────
  const markHeaders = allHeaders.filter(h => {
    const n = norm(h);
    if (h === nameKey || h === rollKey) return false;
    if (NON_MARK_KEYS.has(n)) return false;
    // Must have at least one numeric value across rows to qualify
    const hasNumbers = rawRows.some(row => {
      const v = parseMarkValue(row[h]);
      return v > 0;
    });
    return hasNumbers;
  });

  // ── 4. Build column descriptors ────────────────────────────────────────────
const columns = markHeaders
    .map(header => {
      const maxFromHeader = extractMax(header);
      const maxFromData   = maxFromHeader === null
        ? inferMax(rawRows.map(r => r[header]))
        : null;
      const max = maxFromHeader ?? maxFromData;
      return {
        name           : cleanName(header),
        originalHeader : header,
        max,
      };
    })
    .filter(col => col.max <= 200); // drop roll/SID columns with huge values

  // ── 5. Build normalised student rows ──────────────────────────────────────
  const studentRows = rawRows.map(row => {
    const marks = {};
    for (const col of columns) {
      marks[col.name] = parseMarkValue(row[col.originalHeader]);
    }

    return {
      name : String(row[nameKey] ?? '').trim() || 'Unknown',
      roll : rollKey ? String(row[rollKey] ?? '').trim() : '',
      marks,
    };
  }).filter(s => s.name && s.name !== 'Unknown');  // drop blank rows

  return { columns, studentRows };
}

module.exports = { detectColumns, parseMarkValue };