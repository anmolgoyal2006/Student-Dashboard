/**
 * Classify table columns from cell content + header text (format-agnostic).
 */

const norm = (s) => String(s ?? '').trim().toLowerCase();

function parseMarkValue(val) {
  if (val === null || val === undefined) return 0;
  const s = String(val).trim();
  if (!s) return 0;
  if (/^(ab|absent|a|-|—|n\/a|na|nd|not\s*done)$/i.test(s)) return 0;
  const slashMatch = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*\d/);
  if (slashMatch) return parseFloat(slashMatch[1]);
  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

function valuesForColumn(rows, header) {
  return rows.map((r) => String(r[header] ?? '').trim()).filter((v) => v !== '');
}

function looksLikePersonName(val) {
  const s = String(val ?? '').trim();
  if (!s || s.length < 2) return false;
  if (/^\d+(\.\d+)?$/.test(s)) return false;
  return /[a-zA-Z]{2,}/.test(s) && !/^(ab|absent|na|n\/a|nil|null)$/i.test(s);
}

function looksLikeStudentId(val) {
  const s = String(val ?? '').trim();
  if (/^\d{5,12}$/.test(s)) return true;
  if (/^[a-z]{0,4}\d{5,12}$/i.test(s)) return true;
  return /^[a-z0-9\-_/]{4,20}$/i.test(s) && /\d{3,}/.test(s) && !/[a-z]{4,}/i.test(s.replace(/\d/g, ''));
}

function columnIsSequentialSerial(values) {
  if (values.length < 3) return false;
  const nums = values.map((v) => parseInt(String(v).trim(), 10));
  if (nums.some((n) => isNaN(n))) return false;
  const start = nums[0];
  return nums.every((n, i) => n === start + i);
}

function isAggregateHeader(header) {
  const n = norm(header);
  return ['pretotal', 'grand total', 'grandtotal', 'total marks', 'overall', 'subtotal', 'aggregate']
    .some((h) => n.includes(h));
}

/**
 * @returns {{ type: string, confidence: number, stats: object }}
 * Types: name | student_id | serial | marks | text | empty
 */
function classifyColumn(header, rows) {
  const values = valuesForColumn(rows, header);
  const n = norm(header);
  const total = rows.length || 1;
  const fillRate = values.length / total;

  if (fillRate < 0.05) return { type: 'empty', confidence: 1, stats: { fillRate } };

  let nameHits = 0;
  let idHits = 0;
  let serialHits = 0;
  let numericHits = 0;
  let numericSum = 0;

  values.forEach((v) => {
    if (looksLikePersonName(v)) nameHits++;
    if (looksLikeStudentId(v)) idHits++;
    const num = parseMarkValue(v);
    if (num > 0 || v === '0' || v === 0) {
      numericHits++;
      numericSum += num;
    }
  });

  const nameRatio = nameHits / values.length;
  const idRatio = idHits / values.length;
  const numericRatio = numericHits / values.length;
  const isSequentialSerial = columnIsSequentialSerial(values);

  const headerName = /name|student|candidate|learner|pupil/.test(n);
  const headerId = /sid|roll|enrol|reg|admission|sap|uid|emp/.test(n) && !headerName
    && !/mark|score|quiz|exam/i.test(n);
  const headerSerial = /^(s\.?\s*no\.?|sr\.?\s*no\.?|serial|sl\.?\s*no\.?|#)$/.test(n.replace(/\s/g, ''))
    || n === 'no' || n === 'no.';
  const headerMarks = extractMaxFromHeader(header) !== null
    || /mark|score|quiz|exam|test|lab|mid|end|theory|practical|assignment|mt\b/i.test(n);

  const stats = { fillRate, nameRatio, idRatio, numericRatio, numericSum, isSequentialSerial };

  if ((headerName || nameRatio >= 0.55) && nameRatio >= 0.35) {
    return { type: 'name', confidence: nameRatio + (headerName ? 0.3 : 0), stats };
  }
  if ((headerId || idRatio >= 0.5) && idRatio >= nameRatio) {
    return { type: 'student_id', confidence: idRatio + (headerId ? 0.3 : 0), stats };
  }
  if ((headerSerial || isSequentialSerial) && !headerMarks) {
    return { type: 'serial', confidence: isSequentialSerial ? 0.9 : 0.7, stats };
  }
  if ((headerMarks || numericRatio >= 0.5) && numericRatio >= nameRatio) {
    if (isAggregateHeader(header)) {
      return { type: 'marks_aggregate', confidence: numericRatio, stats };
    }
    return { type: 'marks', confidence: numericRatio + (headerMarks ? 0.2 : 0), stats };
  }
  if (numericRatio >= 0.4 && nameRatio < 0.2) {
    return { type: 'marks', confidence: numericRatio, stats };
  }

  return { type: 'text', confidence: 0.1, stats };
}

function extractMaxFromHeader(header) {
  const bracketMatch = String(header).match(/[(\[]\s*(\d+(?:\.\d+)?)\s*[)\]]/);
  if (bracketMatch) return parseFloat(bracketMatch[1]);
  const slashMatch = String(header).match(/\/\s*(\d+(?:\.\d+)?)\s*$/);
  if (slashMatch) return parseFloat(slashMatch[1]);
  return null;
}

/**
 * Classify all columns in a table.
 */
function classifyTable(rows) {
  if (!rows?.length) return { columns: [], nameKey: null, rollKey: null, markHeaders: [] };

  const headers = Object.keys(rows[0]);
  const classified = headers.map((header) => ({
    header,
    ...classifyColumn(header, rows),
  }));

  const byType = (t) => classified
    .filter((c) => c.type === t)
    .sort((a, b) => b.confidence - a.confidence);

  const nameKey = byType('name')[0]?.header || null;
  const rollKey = byType('student_id')[0]?.header || null;
  const markHeaders = [
    ...byType('marks'),
    ...byType('marks_aggregate'),
  ]
    .filter((c) => c.header !== nameKey && c.header !== rollKey)
    .map((c) => c.header);

  return { columns: classified, nameKey, rollKey, markHeaders };
}

module.exports = {
  classifyTable,
  classifyColumn,
  looksLikePersonName,
  looksLikeStudentId,
  isAggregateHeader,
  parseMarkValue,
};
