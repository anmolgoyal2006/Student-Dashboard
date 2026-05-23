/**
 * Normalize raw PDF table rows before column detection (any layout).
 */

const { looksLikePersonName, looksLikeStudentId } = require('./columnClassifier');

const norm = (s) => String(s ?? '').trim().toLowerCase();

const HEADER_WORDS = [
  'name', 'sid', 'roll', 's.no', 'sno', 'marks', 'score', 'quiz', 'exam',
  'midterm', 'endterm', 'lab', 'theory', 'total', 'student', 'enrollment',
];

function rowLooksLikeHeader(row) {
  const cells = Object.values(row).map((v) => norm(v));
  let hits = 0;
  for (const c of cells) {
    if (!c) continue;
    if (HEADER_WORDS.some((w) => c.includes(w))) hits++;
    if (/\(\s*\d+\s*\)/.test(c)) hits++;
  }
  return hits >= 2;
}

function rowLooksLikeData(row) {
  for (const v of Object.values(row)) {
    if (looksLikePersonName(v) || looksLikeStudentId(v)) return true;
  }
  return false;
}

/** If keys are generic (Column_1…), promote a header row to keys. */
function rekeyFromEmbeddedHeader(rawRows) {
  const keys = Object.keys(rawRows[0] || {});
  const genericKeys = keys.length > 0 && keys.every((k) => /^column_\d+$/i.test(k) || !norm(k));

  if (!genericKeys) return rawRows;

  for (let i = 0; i < Math.min(8, rawRows.length); i++) {
    if (!rowLooksLikeHeader(rawRows[i])) continue;
    const headerCells = Object.values(rawRows[i]).map((v) => String(v ?? '').trim());
    const validHeaders = headerCells.filter(Boolean);
    if (validHeaders.length < 2) continue;

    const out = [];
    for (let j = i + 1; j < rawRows.length; j++) {
      const cells = Object.values(rawRows[j]);
      const obj = {};
      headerCells.forEach((h, idx) => {
        const key = h || `Column_${idx + 1}`;
        obj[key] = cells[idx] !== undefined ? String(cells[idx]).trim() : '';
      });
      if (rowLooksLikeData(obj)) out.push(obj);
    }
    if (out.length) return out;
  }
  return rawRows;
}

/** Drop header repeats, blank rows, and spreadsheet letter rows. */
function filterDataRows(rawRows) {
  return rawRows.filter((row) => {
    const values = Object.values(row).map((v) => String(v ?? '').trim()).filter(Boolean);
    if (!values.length) return false;
    if (rowLooksLikeHeader(row) && !rowLooksLikeData(row)) return false;
    if (values.every((v) => v.length === 1 && /^[a-z]$/i.test(v))) return false;
    return rowLooksLikeData(row);
  });
}

function normalizeRawRows(rawRows) {
  if (!rawRows?.length) return [];
  let rows = rekeyFromEmbeddedHeader(rawRows);
  rows = filterDataRows(rows);
  return rows;
}

module.exports = { normalizeRawRows, rowLooksLikeData };
