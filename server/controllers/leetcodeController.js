const CareerProgress = require('../models/CareerProgress');
const {
  fetchUserStats,
  fetchSkillTagCounts,
  fetchRecentAcSubmissions,
  enrichSubmissionsWithTopics,
  aggregateTagsToDashboardTopics,
  applyLeetcodeTopicsToDsaTopics,
  fetchSolvedSlugs,
  buildLeetcodeInsights,
  buildLeetcodeProblemPicks,
  COMPANY_PROBLEMS,
} = require('../services/leetcodeService');
const { TOPIC_TARGETS } = require('../services/dsaCoachService');

/**
 * Calculate company-specific progress based on solved slugs
 */
function calculateCompanyProgress(solvedSlugs) {
  const solvedSet = new Set(solvedSlugs || []);
  const progress = {};

  for (const [company, topics] of Object.entries(COMPANY_PROBLEMS)) {
    let total = 0;
    let solved = 0;

    for (const [topicName, problems] of Object.entries(topics)) {
      for (const problem of problems) {
        total++;
        if (solvedSet.has(problem.slug)) {
          solved++;
        }
      }
    }

    progress[company] = {
      total,
      solved,
      unsolved: total - solved,
      completionRate: total > 0 ? Math.round((solved / total) * 100) : 0,
    };
  }

  return progress;
}

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
    const solvedSlugSet = await fetchSolvedSlugs(username);
    const solvedSlugs = [...solvedSlugSet];
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

    // Calculate company-specific progress
    const companyProgress = calculateCompanyProgress(solvedSlugs);

    const syncMeta = {
      lastSyncAt: new Date(),
      lastSeenIds: mergedSeen,
      totalOnLeetcode: stats.totalSolved,
      easy: stats.easy,
      medium: stats.medium,
      hard: stats.hard,
      topicCounts: lcByTopic,
      solvedSlugs,
      solvedCount: solvedSlugs.length,
      companyProgress,
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

// GET /api/career/leetcode/company-questions - Get company-specific questions
exports.getCompanyQuestions = async (req, res) => {
  try {
    const { company, topic, difficulty, frequency, limit = 20 } = req.query;
    
    // Get user's career profile
    const career = await CareerProgress.findOne({ userId: req.user.id });
    if (!career) {
      return res.status(404).json({ message: 'Career profile not found.' });
    }

    // Get solved slugs if LeetCode is linked
    let solvedSlugs = new Set();
    if (career.leetcodeSync?.solvedSlugs && Array.isArray(career.leetcodeSync.solvedSlugs)) {
      solvedSlugs = new Set(career.leetcodeSync.solvedSlugs.map(s => String(s).toLowerCase().trim()));
    }

    // Use target company if not specified
    const targetCompany = company || career.targetCompany || 'Amazon';
    
    // Check if company exists in our database
    const companyProblems = COMPANY_PROBLEMS[targetCompany];
    if (!companyProblems) {
      return res.status(400).json({ 
        message: `Company '${targetCompany}' not found. Available companies: ${Object.keys(COMPANY_PROBLEMS).join(', ')}` 
      });
    }

    // Filter and collect problems
    let filteredProblems = [];
    const topicsToInclude = topic ? [topic] : Object.keys(companyProblems);
    
    for (const topicName of topicsToInclude) {
      const topicProblems = companyProblems[topicName];
      if (!topicProblems) continue;

      for (const problem of topicProblems) {
        // Filter by difficulty if specified
        if (difficulty && problem.difficulty !== difficulty) continue;

        // Filter by frequency if specified
        if (frequency && problem.frequency !== frequency) continue;

        filteredProblems.push({
          title: problem.title,
          slug: problem.slug,
          topic: topicName,
          difficulty: problem.difficulty,
          frequency: problem.frequency || 'medium',
          company: targetCompany,
          leetcodeUrl: `https://leetcode.com/problems/${problem.slug}/`,
        });
      }
    }

    // Sort by frequency (high first) then by difficulty
    const frequencyOrder = { high: 0, medium: 1, low: 2 };
    const difficultyOrder = { Easy: 0, Medium: 1, Hard: 2 };
    
    filteredProblems.sort((a, b) => {
      if (frequencyOrder[a.frequency] !== frequencyOrder[b.frequency]) {
        return frequencyOrder[a.frequency] - frequencyOrder[b.frequency];
      }
      return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
    });

    // Apply limit
    const limitedProblems = filteredProblems.slice(0, parseInt(limit));

    // Calculate statistics
    const totalProblemsInCompany = Object.values(companyProblems).flat().length;
    const solvedInCompany = Object.values(companyProblems).flat().filter(p => solvedSlugs.has(p.slug.toLowerCase().trim())).length;
    const unsolvedInCompany = totalProblemsInCompany - solvedInCompany;

    res.json({
      company: targetCompany,
      problems: limitedProblems,
      stats: {
        total: totalProblemsInCompany,
        solved: solvedInCompany,
        unsolved: unsolvedInCompany,
        completionRate: totalProblemsInCompany > 0 ? Math.round((solvedInCompany / totalProblemsInCompany) * 100) : 0,
      },
      filters: {
        topic,
        difficulty,
        frequency,
        limit: parseInt(limit),
      },
      availableTopics: Object.keys(companyProblems),
      availableCompanies: Object.keys(COMPANY_PROBLEMS),
    });
  } catch (err) {
    console.error('Company questions error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to fetch company questions.' });
  }
};
