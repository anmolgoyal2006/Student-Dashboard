const { getGradePoint } = require('../config/gradeConfig');

/**
 * Calculates SGPA from an array of subjects.
 * @param {Array<{ grade: string, credits: number }>} subjects
 * @returns {number} SGPA rounded to 2 decimal places
 */
const calculateSGPA = (subjects) => {
  if (!subjects || subjects.length === 0) return 0;

  let totalWeighted = 0;
  let totalCredits  = 0;

  for (const { grade, credits } of subjects) {
    const point = getGradePoint(grade);   // throws on invalid grade
    totalWeighted += point * credits;
    totalCredits  += credits;
  }

  if (totalCredits === 0) return 0;
  return parseFloat((totalWeighted / totalCredits).toFixed(2));
};

/**
 * Calculates CGPA as simple average of all semester SGPAs.
 * @param {number[]} sgpaList
 * @returns {number} CGPA rounded to 2 decimal places
 */
const calculateCGPA = (sgpaList) => {
  if (!sgpaList || sgpaList.length === 0) return 0;
  const sum = sgpaList.reduce((acc, s) => acc + s, 0);
  return parseFloat((sum / sgpaList.length).toFixed(2));
};

module.exports = { calculateSGPA, calculateCGPA };