const { cosineSimilarity } = require('../services/ragService');

// The RAG fix replaced keyword matching with real vector similarity —
// this covers the similarity math that ranks retrieved note chunks.
describe('ragService.cosineSimilarity', () => {
  test('identical vectors → 1', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
  });

  test('parallel (scaled) vectors → 1', () => {
    expect(cosineSimilarity([1, 0, 0], [2, 0, 0])).toBeCloseTo(1, 5);
  });

  test('orthogonal vectors → 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  test('opposite vectors → -1', () => {
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1, 5);
  });

  test('mismatched length or empty → 0 (safe, no crash)', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0); // zero-magnitude guard
  });
});
