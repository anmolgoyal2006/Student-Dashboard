const CareerProgress = require('../models/CareerProgress');
const {
  fetchUserStats,
  fetchSkillTagCounts,
  fetchRecentAcSubmissions,
  enrichSubmissionsWithTopics,
  aggregateTagsToDashboardTopics,
  applyLeetcodeTopicsToDsaTopics,
} = require('../services/leetcodeService');
const { TOPIC_TARGETS } = require('../services/dsaCoachService');

const TOPIC_COMPLETE_THRESHOLD = 15;

function calcReadiness(problems) {
  if (problems >= 200) return 'Ready';
  if (problems >= 100) return 'Intermediate';
  return 'Beginner';
}

function normalizeUsername(raw) {
  return String(raw || '').trim().toLowerCase();
}

// PUT /api/career/leetcode — save LeetCode username
exports.linkLeetcode = async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    if (!username) {
      return res.status(400).json({ message: 'LeetCode username is required.' });
    }
    if (!/^[a-z0-9_-]{1,30}$/i.test(username)) {
      return res.status(400).json({ message: 'Invalid LeetCode username format.' });
    }

    await fetchUserStats(username);

    const career = await CareerProgress.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { leetcodeUsername: username } },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({ message: 'LeetCode account linked', career });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ message: err.message });
    }
    res.status(502).json({ message: err.message || 'Could not verify LeetCode user' });
  }
};

// DELETE /api/career/leetcode — unlink
exports.unlinkLeetcode = async (req, res) => {
  try {
    const career = await CareerProgress.findOneAndUpdate(
      { userId: req.user.id },
      {
        $unset: { leetcodeUsername: '', leetcodeSync: '' },
      },
      { new: true }
    );
    res.json({ message: 'LeetCode disconnected', career });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/career/leetcode/sync
exports.syncLeetcode = async (req, res) => {
  try {
    let career = await CareerProgress.findOne({ userId: req.user.id });
    if (!career) {
      return res.status(404).json({ message: 'Career profile not found.' });
    }

    const username = normalizeUsername(req.body.username || career.leetcodeUsername);
    if (!username) {
      return res.status(400).json({
        message: 'Link your LeetCode username first.',
      });
    }

    const stats = await fetchUserStats(username);
    const tagRows = await fetchSkillTagCounts(username);
    const lcByTopic = aggregateTagsToDashboardTopics(tagRows);
    const recent = await fetchRecentAcSubmissions(username, 50);

    const seen = new Set(career.leetcodeSync?.lastSeenIds || []);
    const isFirstSync = !career.leetcodeSync?.lastSyncAt;
    const newSubs = isFirstSync ? [] : recent.filter((s) => s.id && !seen.has(String(s.id)));

    let enrichedNew = [];
    if (newSubs.length > 0) {
      enrichedNew = await enrichSubmissionsWithTopics(newSubs, 20);
    }

    const topicIncrements = {};
    const newTitles = [];

    for (const sub of enrichedNew) {
      newTitles.push(sub.title);
      for (const topic of sub.topics || []) {
        topicIncrements[topic] = (topicIncrements[topic] || 0) + 1;
      }
    }

    if (career.dsaTopics?.length) {
      for (const t of career.dsaTopics) {
        const add = topicIncrements[t.name] || 0;
        if (add > 0) t.problems = (t.problems || 0) + add;
      }
      career.dsaTopics = applyLeetcodeTopicsToDsaTopics(
        career.dsaTopics,
        lcByTopic,
        TOPIC_TARGETS
      );
    }

    const allIds = recent.map((s) => String(s.id)).filter(Boolean);
    const mergedSeen = [...new Set([...allIds, ...seen])].slice(-120);

    const problemsSolved = stats.totalSolved;
    const readiness = calcReadiness(problemsSolved);

    const syncMeta = {
      lastSyncAt: new Date(),
      lastSeenIds: mergedSeen,
      totalOnLeetcode: stats.totalSolved,
      easy: stats.easy,
      medium: stats.medium,
      hard: stats.hard,
      topicCounts: lcByTopic,
    };

    const update = {
      leetcodeUsername: username,
      problemsSolved,
      readiness,
      dsaTopics: career.dsaTopics,
      leetcodeSync: syncMeta,
    };

    if (enrichedNew.length > 0) {
      const session = {
        date: new Date(),
        note: `LeetCode sync: ${enrichedNew.map((s) => s.title).join(', ')}`,
        problemsAdded: enrichedNew.length,
        topics: [...new Set(enrichedNew.flatMap((s) => s.topics || []))],
        aiFeedback: 'Synced from LeetCode',
      };
      career = await CareerProgress.findOneAndUpdate(
        { userId: req.user.id },
        {
          $set: update,
          $unset: { dsaCoach: '' },
          $push: {
            dsaSessions: {
              $each: [session],
              $position: 0,
              $slice: 30,
            },
          },
        },
        { new: true }
      );
    } else {
      career = await CareerProgress.findOneAndUpdate(
        { userId: req.user.id },
        { $set: update, $unset: { dsaCoach: '' } },
        { new: true }
      );
    }

    res.json({
      message: isFirstSync
        ? `Linked @${username}. ${stats.totalSolved} problems on LeetCode — topic counts updated from your profile.`
        : enrichedNew.length > 0
          ? `Synced ${enrichedNew.length} new problem(s). Coach will use your real LeetCode tags.`
          : `Synced ${stats.totalSolved} problems — topic stats refreshed from LeetCode.`,
      career,
      sync: {
        ...syncMeta,
        newCount: enrichedNew.length,
        newProblems: newTitles,
        isFirstSync,
      },
    });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ message: err.message });
    }
    console.error('LeetCode sync error:', err.message);
    res.status(502).json({
      message: err.message || 'Failed to sync with LeetCode. Try again in a minute.',
    });
  }
};
