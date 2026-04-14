/**
 * weightCalculator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Applies column filtering + custom weightage to normalised student data.
 *
 * EXPORTS
 *   calculateWeightedScores(studentRows, columns, selectedColumns, weights)
 *     → Array<{ name, roll, marks, breakdown, totalScore }>
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * @param {Array<{ name, roll, marks }>}  studentRows
 *   Output of columnDetector.detectColumns()
 *
 * @param {Array<{ name, originalHeader, max }>} columns
 *   Column descriptors from columnDetector.detectColumns()
 *
 * @param {string[]} selectedColumns
 *   Column NAMES the user wants to include, e.g. ["Quiz1", "MidSem"]
 *   Pass null / [] to include ALL columns.
 *
 * @param {Object} weights
 *   Custom out-of value per column, e.g. { Quiz1: 10, MidSem: 20 }
 *   If a column is not present here, its originalMax is used as its weight
 *   (i.e. marks are kept as-is after normalisation).
 *
 * @returns {Array<{
 *   name        : string,
 *   roll        : string,
 *   marks       : Object,          // raw marks (filtered columns only)
 *   breakdown   : Object,          // { colName: { raw, max, weight, score } }
 *   totalScore  : number           // sum of weighted scores, rounded to 2dp
 * }>}
 */
function calculateWeightedScores(studentRows, columns, selectedColumns, weights = {}) {
  // ── 1. Resolve which columns are active ───────────────────────────────────
  const useAll     = !selectedColumns || selectedColumns.length === 0;
  const activeSet  = useAll
    ? new Set(columns.map(c => c.name))
    : new Set(selectedColumns);

  const activeCols = columns.filter(c => activeSet.has(c.name));

  if (!activeCols.length) {
    // Nothing selected — return students with 0 score
    return studentRows.map(s => ({
      name       : s.name,
      roll       : s.roll,
      marks      : {},
      breakdown  : {},
      totalScore : 0,
    }));
  }

  // ── 2. For each column, resolve the effective weight ──────────────────────
  //   normalised = (raw / originalMax) * newWeight
  const colMeta = activeCols.map(col => ({
    ...col,
    effectiveWeight : weights[col.name] !== undefined
      ? Number(weights[col.name])
      : col.max,                           // default: use original max (normalised score = raw)
  }));

  // ── 3. Score every student ────────────────────────────────────────────────
  return studentRows.map(student => {
    const filteredMarks = {};
    const breakdown     = {};
    let   total         = 0;

    for (const col of colMeta) {
      const raw    = student.marks[col.name] ?? 0;
      const max    = col.max > 0 ? col.max : 1;           // guard divide-by-zero
      const weight = col.effectiveWeight;
      const score  = (raw / max) * weight;

      filteredMarks[col.name] = raw;
      breakdown[col.name]     = {
        raw,
        max    : col.max,
        weight,
        score  : Math.round(score * 100) / 100,
      };
      total += score;
    }

    return {
      name       : student.name,
      roll       : student.roll,
      marks      : filteredMarks,
      breakdown,
      totalScore : Math.round(total * 100) / 100,
    };
  });
}

/**
 * Utility: build a default weights object from columns
 * (each column's weight = its original max marks).
 *
 * Useful for initialising the frontend weight inputs.
 */
function defaultWeights(columns) {
  return Object.fromEntries(columns.map(c => [c.name, c.max]));
}

module.exports = { 
  applyWeights: calculateWeightedScores,
  defaultWeights 
};