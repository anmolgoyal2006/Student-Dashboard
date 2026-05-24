/**
 * columnDetector.js — format-agnostic marks table detection.
 */

const { normalizeRawRows } = require('./tableNormalizer');
const {
  classifyTable,
  looksLikePersonName,
  looksLikeStudentId,
  isAggregateHeader,
  parseMarkValue,
} = require('./columnClassifier');

const norm = (s) => String(s ?? '').trim().toLowerCase();

function extractMax(header) {
  const bracketMatch = String(header).match(/[(\[]\s*(\d+(?:\.\d+)?)\s*[)\]]/);
  if (bracketMatch) return parseFloat(bracketMatch[1]);
  const slashMatch = String(header).match(/\/\s*(\d+(?:\.\d+)?)\s*$/);
  if (slashMatch) return parseFloat(slashMatch[1]);
  return null;
}

function cleanName(header) {
  return String(header)
    .replace(/[(\[]\s*\d+(?:\.\d+)?\s*[)\]]/g, '')
    .replace(/\/\s*\d+(?:\.\d+)?\s*$/g, '')
    .trim() || 'Column';
}

function inferMax(values) {
  const nums = values.map(parseMarkValue).filter((n) => n > 0);
  if (!nums.length) return 100;
  return Math.max(...nums);
}

function resolveIdentity(row, nameKey, rollKey, allHeaders, markHeaders) {
  let name = nameKey ? String(row[nameKey] ?? '').trim() : '';
  let roll = rollKey ? String(row[rollKey] ?? '').trim() : '';
  const skip = new Set([nameKey, rollKey, ...markHeaders].filter(Boolean));

  if (!looksLikePersonName(name)) {
    for (const h of allHeaders) {
      if (skip.has(h)) continue;
      const v = String(row[h] ?? '').trim();
      if (looksLikePersonName(v)) {
        if (looksLikeStudentId(name) && !roll) roll = name;
        name = v;
        break;
      }
    }
  }

  if (!roll || !looksLikeStudentId(roll)) {
    for (const h of allHeaders) {
      if (skip.has(h) || h === nameKey) continue;
      const v = String(row[h] ?? '').trim();
      if (looksLikeStudentId(v)) {
        roll = v;
        break;
      }
    }
  }

  if (looksLikePersonName(roll) && !looksLikePersonName(name)) {
    [name, roll] = [roll, looksLikeStudentId(name) ? name : ''];
  }

  return { name: name.trim(), roll: roll.trim() };
}

function detectColumns(rawRows) {
  const rows = normalizeRawRows(rawRows);
  if (!rows.length) return { columns: [], studentRows: [] };

  const allHeaders = Object.keys(rows[0]);
  const { nameKey, rollKey, markHeaders } = classifyTable(rows);

  const columns = markHeaders
    .map((header) => {
      const maxFromHeader = extractMax(header);
      const max = maxFromHeader ?? inferMax(rows.map((r) => r[header]));
      return {
        name           : cleanName(header),
        originalHeader : header,
        max,
        isAggregate    : isAggregateHeader(header),
      };
    })
    .filter((col) => col.max > 0 && col.max <= 300);

  const usedNames = {};
  for (const col of columns) {
    const base = col.name;
    const n = usedNames[base] || 0;
    usedNames[base] = n + 1;
    if (n > 0) col.name = `${base} ${n + 1}`;
  }

  const studentRows = rows
    .map((row) => {
      const marks = {};
      for (const col of columns) {
        marks[col.name] = parseMarkValue(row[col.originalHeader]);
      }
      const { name, roll } = resolveIdentity(row, nameKey, rollKey, allHeaders, markHeaders);
      return { name, roll, marks };
    })
    .filter((s) => looksLikePersonName(s.name));

  // Deduplicate student rows by roll number (or name if roll is absent) to guarantee unique entries
  const seenStudents = new Set();
  const uniqueStudentRows = [];
  for (const s of studentRows) {
    const key = s.roll ? `roll:${s.roll.toLowerCase()}` : `name:${s.name.toLowerCase()}`;
    if (!seenStudents.has(key)) {
      seenStudents.add(key);
      uniqueStudentRows.push(s);
    }
  }

  return { columns, studentRows: uniqueStudentRows };
}

module.exports = { detectColumns, parseMarkValue };
