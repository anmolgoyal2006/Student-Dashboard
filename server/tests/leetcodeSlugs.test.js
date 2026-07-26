const mongoose = require('mongoose');
const CareerProgress = require('../models/CareerProgress');
const leetcodeService = require('../services/leetcodeService');

// LeetCode dropped `matchedUser.acSubmissionList` and the `username` argument on
// `submissionList`; both now hard-400. `recentAcSubmissionList` is all that is
// left and it only returns a ~20-entry moving window. Overwriting the stored
// slug set with that window makes a user's solved history shrink on every sync.
describe('LeetCode solved-slug accumulation', () => {
  const userId = new mongoose.Types.ObjectId();

  const seedCareer = (solvedSlugs) =>
    CareerProgress.create({
      userId,
      leetcodeUsername: 'someuser',
      dsaTopics: [{ name: 'Arrays', problems: 1 }],
      leetcodeSync: {
        lastSyncAt: new Date(Date.now() - 86400000),
        lastSeenIds: ['1'],
        solvedSlugs,
      },
    });

  const mockWindow = (slugs) => {
    jest.spyOn(leetcodeService, 'fetchUserStats').mockResolvedValue({
      username: 'someuser', totalSolved: 40, easy: 20, medium: 15, hard: 5,
    });
    jest.spyOn(leetcodeService, 'fetchSkillTagCounts').mockResolvedValue([]);
    jest.spyOn(leetcodeService, 'fetchSolvedSlugs').mockResolvedValue(new Set(slugs));
    jest.spyOn(leetcodeService, 'fetchRecentAcSubmissions').mockResolvedValue([]);
  };

  const runSync = async () => {
    // Required after the mocks are installed so the controller binds to them.
    const { syncLeetcode } = require('../controllers/leetcodeController');
    const res = {
      statusCode: 200, body: null,
      status(c) { this.statusCode = c; return this; },
      json(p) { this.body = p; return this; },
    };
    await syncLeetcode({ user: { id: String(userId) }, body: {} }, res);
    return res;
  };

  afterEach(() => jest.restoreAllMocks());

  test('a sync window that omits older slugs does not shrink the stored set', async () => {
    await seedCareer(['two-sum', 'add-two-numbers', 'valid-parentheses']);
    mockWindow(['merge-two-sorted-lists']); // recent window, none of the old ones

    const res = await runSync();
    expect(res.statusCode).toBe(200);

    const saved = await CareerProgress.findOne({ userId });
    expect(saved.leetcodeSync.solvedSlugs.sort()).toEqual([
      'add-two-numbers', 'merge-two-sorted-lists', 'two-sum', 'valid-parentheses',
    ]);
  });

  test('company progress does not regress across syncs', async () => {
    await seedCareer(['two-sum', 'add-two-numbers', 'valid-parentheses']);
    mockWindow([]); // LeetCode returns an empty window

    await runSync();

    const saved = await CareerProgress.findOne({ userId });
    expect(saved.leetcodeSync.solvedCount).toBeGreaterThanOrEqual(3);
  });

  test('fetchSolvedSlugs no longer issues the removed GraphQL queries', () => {
    const src = require('fs').readFileSync(
      require.resolve('../services/leetcodeService'), 'utf8'
    );
    // Both hard-400 against the live API; keeping them burns the circuit breaker.
    expect(src).not.toMatch(/acSubmissionList\(limit/);
    expect(src).not.toMatch(/submissionList\(username/);
  });
});
