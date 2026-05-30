/**
 * Extract per-student marks from parsed PDF rows (one entry per column/score).
 */

const { detectColumns } = require('./columnDetector');
const { defaultWeights, applyWeights } = require('./weightCalculator');

/**
 * @param {Array<Object>} rawRows - rows from parsePdf.py or parseScannedGradePdf
 */
function studentsFromRawRows(rawRows) {
  // Detect OCR rows — preserve all fields, bypass column detection
  const isOcrSource = Array.isArray(rawRows) && rawRows.some((r) => r.source === 'ocr' || r.ocrGradeRaw);

  if (isOcrSource) {
    const studentRows = rawRows.map((r) => ({
      name: r.name || 'Unknown Student',
      roll: r.roll || '',
      grade: r.grade || '',
      marks: r.marks || { Grade: r.grade || '' },
      ocrGradeRaw: r.ocrGradeRaw || '',
      ocrConfidence: r.ocrConfidence || 0,
      ocrConfidenceLevel: r.ocrConfidenceLevel || 'low',
      overallConfidence: r.overallConfidence || 0,
      gradeImage: r.gradeImage || '',
      sidImage: r.sidImage || '',
      source: 'ocr',
      ocrWarning: r.ocrWarning || '',
    }));

    return {
      columns: [{ name: 'Grade', max: 10 }],
      studentRows,
      columnWeights: { Grade: 10 },
      selectedColumns: ['Grade'],
    };
  }

  const { columns, studentRows } = detectColumns(rawRows);
  if (!studentRows.length) return { columns, studentRows: [], columnWeights: {} };

  const columnWeights = defaultWeights(columns);

  // Check if a pretotal column is present (case-insensitive)
  const pretotalCol = columns.find((c) => {
    const nameLower = (c.name || '').toLowerCase();
    const headerLower = (c.originalHeader || '').toLowerCase();
    return nameLower.includes('pretotal') || headerLower.includes('pretotal');
  });

  let selectedColumns;
  if (pretotalCol) {
    selectedColumns = [pretotalCol.name];
  } else {
    selectedColumns = columns
      .filter((c) => !c.isAggregate)
      .map((c) => c.name);
  }

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
