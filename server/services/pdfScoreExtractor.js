/**
 * Extract per-student marks from parsed PDF rows (one entry per column/score).
 */

const { detectColumns } = require('./columnDetector');
const { defaultWeights, applyWeights } = require('./weightCalculator');

/**
 * @param {Array<Object>} rawRows - rows from parsePdf.py
 */
function studentsFromRawRows(rawRows) {
  const { columns, studentRows } = detectColumns(rawRows);
  if (!studentRows.length) return { columns, studentRows: [], columnWeights: {} };

  const columnWeights = defaultWeights(columns);
  const selectedColumns = columns
    .filter((c) => !c.isAggregate)
    .map((c) => c.name);

  return {
    columns,
    studentRows,
    columnWeights,
    selectedColumns: selectedColumns.length ? selectedColumns : columns.map((c) => c.name),
  };
}

/**
 * Apply per-column weights → one score per student for a PDF source.
 */
function scoreStudentsForSource({ studentRows, columns, selectedColumns, columnWeights }) {
  const active = selectedColumns?.length
    ? selectedColumns
    : columns.map((c) => c.name);

  const weighted = applyWeights(studentRows, columns, active, columnWeights || {});

  return weighted.map((w) => ({
    name : w.name,
    roll : w.roll || '',
    score: w.totalScore,
    breakdown: w.breakdown,
  }));
}

/**
 * File-level weight = sum of weights on selected score columns.
 */
function computeSourceFileWeight(columns, selectedColumns, columnWeights = {}) {
  const active = selectedColumns?.length
    ? selectedColumns
    : columns.map((c) => c.name);
  const maxByCol = Object.fromEntries(columns.map((c) => [c.name, c.max]));

  return active.reduce((sum, col) => {
    const w = columnWeights[col];
    const effective = w !== undefined && w !== '' ? Number(w) : (maxByCol[col] || 0);
    return sum + (Number.isFinite(effective) ? effective : 0);
  }, 0);
}

module.exports = {
  studentsFromRawRows,
  scoreStudentsForSource,
  computeSourceFileWeight,
};
