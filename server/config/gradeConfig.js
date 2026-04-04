// ─── Single source of truth for grade mapping ───────────────────────────────
// To change grading system, edit ONLY this file.

const GRADE_MAP = {
  'A+': 10,
  'A':   9,
  'B+':  8,
  'B':   7,
  'C':   6,
  'D':   5,
  'F':   0,
};

/**
 * Returns grade point for a given grade string.
 * Throws if grade is not in GRADE_MAP.
 */
const getGradePoint = (grade) => {
  if (!(grade in GRADE_MAP)) {
    throw new Error(`Invalid grade "${grade}". Allowed: ${Object.keys(GRADE_MAP).join(', ')}`);
  }
  return GRADE_MAP[grade];
};

/** Sorted grade options for dropdowns [ { grade, point } ] */
const GRADE_OPTIONS = Object.entries(GRADE_MAP)
  .sort((a, b) => b[1] - a[1])
  .map(([grade, point]) => ({ grade, point }));

/** Valid grade keys as array */
const VALID_GRADES = Object.keys(GRADE_MAP);

module.exports = { GRADE_MAP, getGradePoint, GRADE_OPTIONS, VALID_GRADES };