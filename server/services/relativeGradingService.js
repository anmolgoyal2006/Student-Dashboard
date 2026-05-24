/**
 * relativeGradingService.js
 * 
 * Production-quality service for calculating proportional distributions,
 * validating grade counts, and assigning relative grades to ranked students.
 */

const targetRatios = {
  'A+' : 0.1077,
  'A'  : 0.1538,
  'B+' : 0.1923,
  'B'  : 0.2308,
  'C+' : 0.1538,
  'C'  : 0.0769,
  'D'  : 0.0462,
  'F'  : 0.0385,
};

const gradesOrder = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'];

/**
 * Calculates a mathematically correct proportional distribution that always
 * sums exactly to totalStudents.
 * 
 * Algorithm:
 * a. Compute exact decimal counts
 * b. Take Math.floor() of each
 * c. Compute remaining students
 * d. Distribute remaining students to grades with highest decimal remainders
 * 
 * @param {number} totalStudents 
 * @returns {Object} Mapping of grade keys to integer counts
 */
function calculateDefaultDistribution(totalStudents) {
  if (!Number.isInteger(totalStudents) || totalStudents <= 0) {
    // Return empty distribution if total is invalid
    return Object.fromEntries(gradesOrder.map((g) => [g, 0]));
  }

  const floorCounts = {};
  const remainders = [];
  let allocated = 0;

  gradesOrder.forEach((grade) => {
    const ratio = targetRatios[grade];
    const exact = totalStudents * ratio;
    const floor = Math.floor(exact);
    const rem = exact - floor;

    floorCounts[grade] = floor;
    allocated += floor;

    remainders.push({ grade, rem });
  });

  // Sort remainders descending by remainder value. 
  // Keep standard grades ordering in case of exact ties to avoid ambiguity.
  remainders.sort((a, b) => {
    if (Math.abs(a.rem - b.rem) < 1e-9) {
      return gradesOrder.indexOf(a.grade) - gradesOrder.indexOf(b.grade);
    }
    return b.rem - a.rem;
  });

  let remaining = totalStudents - allocated;
  for (let i = 0; i < remaining; i++) {
    const targetGrade = remainders[i].grade;
    floorCounts[targetGrade] += 1;
  }

  return floorCounts;
}

/**
 * Validates a custom set of grade counts against totalStudents.
 * 
 * @param {Object} gradeCounts - Mapping of grade keys to counts
 * @param {number} totalStudents 
 * @returns {Object} { isValid, allocated, remaining, overflow }
 */
function validateGradeCounts(gradeCounts, totalStudents) {
  const counts = gradeCounts || {};
  const allocated = gradesOrder.reduce((sum, g) => sum + (Math.max(0, parseInt(counts[g]) || 0)), 0);
  const remaining = Math.max(0, totalStudents - allocated);
  const overflow = Math.max(0, allocated - totalStudents);
  const isValid = allocated === totalStudents;

  return {
    isValid,
    allocated,
    remaining,
    overflow,
  };
}

/**
 * Assigns relative grades based on sorted ranks.
 * 
 * @param {Array<Object>} sortedStudents - Students sorted descending by marks
 * @param {Object} gradeCounts - Mapping of grade keys to counts
 * @returns {Array<Object>} Updated student list with grade assigned
 */
function assignRelativeGrades(sortedStudents, gradeCounts) {
  const counts = gradeCounts || {};
  let studentIdx = 0;

  return sortedStudents.map((student) => {
    let assignedGrade = 'F'; // Default fallback
    let cumulative = 0;

    for (const grade of gradesOrder) {
      const quota = Math.max(0, parseInt(counts[grade]) || 0);
      cumulative += quota;
      if (studentIdx < cumulative) {
        assignedGrade = grade;
        break;
      }
    }

    studentIdx++;
    return {
      ...student,
      grade: assignedGrade,
    };
  });
}

module.exports = {
  calculateDefaultDistribution,
  validateGradeCounts,
  assignRelativeGrades,
};
