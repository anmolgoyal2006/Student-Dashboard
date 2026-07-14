const { calculateSGPA, calculateCGPA } = require('../utils/gradeUtils');

describe('gradeUtils.calculateSGPA', () => {
  test('credit-weighted average of grade points', () => {
    // A+ (10) x 4cr + B (7) x 2cr = 40 + 14 = 54, / 6cr = 9.0
    const sgpa = calculateSGPA([
      { grade: 'A+', credits: 4 },
      { grade: 'B', credits: 2 },
    ]);
    expect(sgpa).toBeCloseTo(9.0, 2);
  });

  test('returns 0 for empty / missing subjects (no divide-by-zero)', () => {
    expect(calculateSGPA([])).toBe(0);
    expect(calculateSGPA(null)).toBe(0);
    expect(calculateSGPA(undefined)).toBe(0);
  });

  test('returns 0 when total credits are 0', () => {
    expect(calculateSGPA([{ grade: 'A', credits: 0 }])).toBe(0);
  });
});

describe('gradeUtils.calculateCGPA', () => {
  test('simple average of semester SGPAs', () => {
    expect(calculateCGPA([8, 9, 10])).toBeCloseTo(9.0, 2);
  });

  test('returns 0 for empty / missing list (no divide-by-zero)', () => {
    expect(calculateCGPA([])).toBe(0);
    expect(calculateCGPA(null)).toBe(0);
  });

  test('withWeightedTotal guards against zero credits', () => {
    expect(calculateCGPA.withWeightedTotal(90, 0)).toBe(0);
    expect(calculateCGPA.withWeightedTotal(54, 6)).toBeCloseTo(9.0, 2);
  });
});
