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
  // A person's name never contains digits (0-9)
  if (/\d/.test(s)) return false;
  
  const lower = s.toLowerCase();
  
  const badKeywords = [
    'total', 'average', 'avg', 'maximum', 'minimum', 'max', 'min', 'mean', 'median', 'std dev', 'highest', 'lowest',
    'topper', 'pass', 'fail', 'absent', 'present', 'grand total', 'subtotal', 'aggregate', 'marks', 'score',
    'grade', 'gpa', 'cgpa', 'pretotal', 'page', 'signature', 'instructor', 'coordinator', 'hod', 'director',
    'dean', 'professor', 'teacher', 'examiner', 'course', 'subject', 'code', 'title', 'branch', 'session',
    'semester', 'serial', 'sr. no', 's.no', 'sl.no', 'roll no', 'rollno', 'enrollment', 'enrolment', 'reg. no',
    'reg no', 'registration', 'absentee', 'class', 'summary', 'percentage', 'result', 'status', 'checked by',
    'verified by', 'date', 'remark', 'theory', 'practical', 'assignment', 'quiz', 'midsem', 'endsem', 'mid term',
    'end term', 'evaluated by', 'prepared by', 'marksheet', 'total marks', 'out of', 'roll_no',
    'sl no', 'sr no', 's no', 'sl. no', 'sr. no', 'serial no', 'academic', 'college', 'university', 'department',
    'institute', 'btech', 'mtech', 'b.tech', 'm.tech', 'examination', 'semester', 'academic year', 'group', 'section'
  ];
  
  if (badKeywords.some(keyword => lower === keyword || lower.startsWith(keyword) || lower.endsWith(keyword) || lower.includes(' ' + keyword) || lower.includes(keyword + ' '))) {
    return false;
  }
  
  if (/^(ab|absent|na|n\/a|nil|null|none|total|avg|max|min|mean|yes|no|pass|fail|grade|score|marks|s\.no|sr\.no|sl\.no|roll|rollno|enrol|enroll|reg|reg\.no|sno|slno|srno|overall)$/i.test(s)) {
    return false;
  }

  if (!/[a-zA-Z]{2,}/.test(s)) return false;
  if (/^[_\-\s|=+*#@!$%^&()]+$/.test(s)) return false;

  return true;
}

function looksLikeStudentId(val) {
  const s = String(val ?? '').trim();
  if (/^\d{5,12}$/.test(s)) return true;
  if (/^[a-z]{0,4}\d{5,12}$/i.test(s)) return true;
  return /^[a-z0-9\-_/]{4,20}$/i.test(s) && /\d{3,}/.test(s) && !/[a-z]{4,}/i.test(s.replace(/\d/g, ''));
}

function columnIsSequentialSerial(values) {
  const nums = values
    .map((v) => parseInt(String(v).trim(), 10))
    .filter((n) => !isNaN(n));
  
  if (nums.length < 3) return false;
  
  // Check how many numbers strictly increase by exactly 1
  let sequentialCount = 0;
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i + 1] === nums[i] + 1) {
      sequentialCount++;
    }
  }
  
  // If at least 75% of numeric rows are strictly sequential (+1), it is a serial column
  return (sequentialCount / (nums.length - 1)) >= 0.75;
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
  const headerSerial = /^(s\.?\s*no\.?|sr\.?\s*no\.?|serial|sl\.?\s*no\.?|#|sno|srno|slno)$/.test(n.replace(/\s/g, ''))
    || n === 'no' || n === 'no.' || n.includes('serial') || n.includes('s.no') || n.includes('sr.no') || n.includes('sl.no');
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
