const axios = require('axios');

const LC_GRAPHQL = 'https://leetcode.com/graphql';
const LC_HEADERS = {
  'Content-Type': 'application/json',
  Referer: 'https://leetcode.com',
  Origin: 'https://leetcode.com',
  'User-Agent': 'StudentDashboard/1.0',
};

/** Map LeetCode tag slugs/names → dashboard DSA topic names */
const TAG_TO_TOPIC = {
  array: 'Arrays',
  'hash-table': 'Hashing',
  hashing: 'Hashing',
  string: 'Strings',
  'linked-list': 'Linked Lists',
  stack: 'Stacks & Queues',
  queue: 'Stacks & Queues',
  tree: 'Trees',
  'binary-tree': 'Trees',
  'binary-search-tree': 'Trees',
  graph: 'Graphs',
  'dynamic-programming': 'Dynamic Programming',
  'divide-and-conquer': 'Recursion & Backtracking',
  backtracking: 'Recursion & Backtracking',
  recursion: 'Recursion & Backtracking',
  'binary-search': 'Sorting & Searching',
  sorting: 'Sorting & Searching',
  greedy: 'Greedy',
  trie: 'Tries',
  'bit-manipulation': 'Hashing',
  math: 'Arrays',
  geometry: 'Arrays',
  simulation: 'Arrays',
};

const DASHBOARD_TOPICS = new Set(Object.values(TAG_TO_TOPIC));

async function lcQuery(query, variables = {}) {
  const { data } = await axios.post(
    LC_GRAPHQL,
    { query, variables },
    { headers: LC_HEADERS, timeout: 15000 }
  );
  if (data.errors?.length) {
    const msg = data.errors.map((e) => e.message).join('; ');
    throw new Error(msg || 'LeetCode API error');
  }
  return data.data;
}

/**
 * @param {string} username
 * @returns {{ username: string, totalSolved: number, easy: number, medium: number, hard: number }}
 */
async function fetchUserStats(username) {
  const query = `
    query userPublicProfile($username: String!) {
      matchedUser(username: $username) {
        username
        submitStats {
          acSubmissionNum {
            difficulty
            count
          }
        }
      }
    }
  `;
  const data = await lcQuery(query, { username });
  const user = data?.matchedUser;
  if (!user) {
    const err = new Error('LeetCode user not found. Check the username (case-sensitive).');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const row of user.submitStats?.acSubmissionNum || []) {
    const d = (row.difficulty || '').toLowerCase();
    if (d === 'easy') counts.easy = row.count;
    else if (d === 'medium') counts.medium = row.count;
    else if (d === 'hard') counts.hard = row.count;
  }
  const totalSolved = counts.easy + counts.medium + counts.hard;

  return {
    username: user.username,
    totalSolved,
    ...counts,
  };
}

/**
 * @param {string} username
 * @param {number} limit
 */
async function fetchRecentAcSubmissions(username, limit = 50) {
  const query = `
    query recentAcSubmissions($username: String!, $limit: Int) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        id
        title
        titleSlug
        timestamp
      }
    }
  `;
  const data = await lcQuery(query, { username, limit });
  return data?.recentAcSubmissionList || [];
}

async function fetchQuestionTopics(titleSlug) {
  const query = `
    query questionTopics($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        topicTags {
          name
          slug
        }
      }
    }
  `;
  const data = await lcQuery(query, { titleSlug });
  return data?.question?.topicTags || [];
}

function mapTagsToDashboardTopics(tags) {
  const matched = new Set();
  for (const tag of tags) {
    const slug = (tag.slug || tag.name || '').toLowerCase().replace(/\s+/g, '-');
    const topic = TAG_TO_TOPIC[slug];
    if (topic && DASHBOARD_TOPICS.has(topic)) matched.add(topic);
  }
  if (matched.size === 0 && tags.length > 0) {
    const name = (tags[0].name || '').toLowerCase();
    for (const [slug, topic] of Object.entries(TAG_TO_TOPIC)) {
      if (name.includes(slug.replace(/-/g, ' ')) || name.includes(slug)) {
        matched.add(topic);
        break;
      }
    }
  }
  return [...matched];
}

/**
 * Resolve topics for new submissions (rate-limited sequential fetches).
 */
async function enrichSubmissionsWithTopics(submissions, maxLookups = 15) {
  const enriched = [];
  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    if (i < maxLookups && sub.titleSlug) {
      try {
        const tags = await fetchQuestionTopics(sub.titleSlug);
        sub.topics = mapTagsToDashboardTopics(tags);
      } catch {
        sub.topics = [];
      }
      await new Promise((r) => setTimeout(r, 120));
    } else {
      sub.topics = [];
    }
    enriched.push(sub);
  }
  return enriched;
}

const TOPIC_STARTERS = {
  Arrays: [
    { title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy' },
    { title: 'Contains Duplicate', slug: 'contains-duplicate', difficulty: 'Easy' },
    { title: 'Best Time to Buy and Sell Stock', slug: 'best-time-to-buy-and-sell-stock', difficulty: 'Easy' },
  ],
  Strings: [
    { title: 'Valid Anagram', slug: 'valid-anagram', difficulty: 'Easy' },
    { title: 'Longest Common Prefix', slug: 'longest-common-prefix', difficulty: 'Easy' },
  ],
  'Linked Lists': [
    { title: 'Reverse Linked List', slug: 'reverse-linked-list', difficulty: 'Easy' },
    { title: 'Merge Two Sorted Lists', slug: 'merge-two-sorted-lists', difficulty: 'Easy' },
  ],
  'Stacks & Queues': [
    { title: 'Valid Parentheses', slug: 'valid-parentheses', difficulty: 'Easy' },
    { title: 'Min Stack', slug: 'min-stack', difficulty: 'Medium' },
  ],
  Trees: [
    { title: 'Maximum Depth of Binary Tree', slug: 'maximum-depth-of-binary-tree', difficulty: 'Easy' },
    { title: 'Invert Binary Tree', slug: 'invert-binary-tree', difficulty: 'Easy' },
  ],
  Graphs: [
    { title: 'Number of Islands', slug: 'number-of-islands', difficulty: 'Medium' },
    { title: 'Clone Graph', slug: 'clone-graph', difficulty: 'Medium' },
  ],
  'Dynamic Programming': [
    { title: 'Climbing Stairs', slug: 'climbing-stairs', difficulty: 'Easy' },
    { title: 'House Robber', slug: 'house-robber', difficulty: 'Medium' },
  ],
  'Recursion & Backtracking': [
    { title: 'Subsets', slug: 'subsets', difficulty: 'Medium' },
    { title: 'Permutations', slug: 'permutations', difficulty: 'Medium' },
  ],
  'Sorting & Searching': [
    { title: 'Binary Search', slug: 'binary-search', difficulty: 'Easy' },
    { title: 'Search Insert Position', slug: 'search-insert-position', difficulty: 'Easy' },
  ],
  Hashing: [
    { title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy' },
    { title: 'Group Anagrams', slug: 'group-anagrams', difficulty: 'Medium' },
  ],
  Greedy: [
    { title: 'Assign Cookies', slug: 'assign-cookies', difficulty: 'Easy' },
    { title: 'Jump Game', slug: 'jump-game', difficulty: 'Medium' },
  ],
  Tries: [
    { title: 'Implement Trie (Prefix Tree)', slug: 'implement-trie-prefix-tree', difficulty: 'Medium' },
  ],
};

const UNCOVERED_THRESHOLD = 3;

/**
 * Build coach-ready insights from career + optional live LeetCode fetch.
 */
async function buildLeetcodeInsights(career, { live = false, topicTargets = {} } = {}) {
  const username = (career.leetcodeUsername || '').trim().toLowerCase();
  if (!username) return null;

  let easy = career.leetcodeSync?.easy ?? 0;
  let medium = career.leetcodeSync?.medium ?? 0;
  let hard = career.leetcodeSync?.hard ?? 0;
  let totalSolved = career.leetcodeSync?.totalOnLeetcode ?? career.problemsSolved ?? 0;

  let recentSolves = [];

  if (live) {
    try {
      const stats = await fetchUserStats(username);
      easy = stats.easy;
      medium = stats.medium;
      hard = stats.hard;
      totalSolved = stats.totalSolved;
      const recent = await fetchRecentAcSubmissions(username, 25);
      const enriched = await enrichSubmissionsWithTopics(recent.slice(0, 12), 12);
      recentSolves = enriched.map((s) => ({
        title: s.title,
        slug: s.titleSlug,
        topics: s.topics || [],
      }));
    } catch (err) {
      console.warn('[LeetCode insights]', err.message);
    }
  }

  const topicCountsFromRecent = {};
  for (const s of recentSolves) {
    for (const t of s.topics) {
      topicCountsFromRecent[t] = (topicCountsFromRecent[t] || 0) + 1;
    }
  }

  const topicRoadmap = (career.dsaTopics || []).map((t) => {
    const solved = t.problems || 0;
    const target = topicTargets[t.name] || 30;
    const gap = Math.max(0, target - solved);
    const uncovered = solved < UNCOVERED_THRESHOLD;
    const weak = !uncovered && gap > 10;
    const status = uncovered ? 'not_covered' : weak ? 'weak' : solved >= target ? 'strong' : 'building';
    const startDifficulty = uncovered || (easy < 40 && totalSolved < 80) ? 'Easy' : weak ? 'Easy' : 'Medium';
    const toSolveThisWeek = uncovered ? 5 : weak ? 4 : 2;

    return {
      topic: t.name,
      status,
      solved,
      target,
      gap,
      toSolveThisWeek,
      startWith: startDifficulty,
      priority: uncovered ? 'high' : weak ? 'medium' : 'low',
      recentOnLeetcode: topicCountsFromRecent[t.name] || 0,
    };
  });

  const uncoveredTopics = topicRoadmap.filter((t) => t.status === 'not_covered').map((t) => t.topic);
  const weakTopics = topicRoadmap.filter((t) => t.status === 'weak').map((t) => t.topic);
  const easyRatio = totalSolved > 0 ? Math.round((easy / totalSolved) * 100) : 0;

  let difficultyAdvice = '';
  if (totalSolved < 50 || easyRatio < 35) {
    difficultyAdvice = 'Your LeetCode profile is light on Easy problems — start every new topic with 3–5 Easy problems before Medium.';
  } else if (hard < 5 && totalSolved > 80) {
    difficultyAdvice = 'Add 1–2 Hard problems per week on topics you already know (Trees, Graphs, DP).';
  } else {
    difficultyAdvice = 'Balance: 60% Medium revision, 30% new topic Easy, 10% Hard challenge.';
  }

  const dailyProblemTarget = uncoveredTopics.length >= 4 ? 2 : uncoveredTopics.length >= 2 ? 3 : 2;

  return {
    username,
    totalSolved,
    easy,
    medium,
    hard,
    easyRatio,
    uncoveredTopics,
    weakTopics,
    topicRoadmap,
    recentSolves: recentSolves.slice(0, 8),
    difficultyAdvice,
    dailyProblemTarget,
    linked: true,
  };
}

function leetcodeUrl(slug) {
  return slug ? `https://leetcode.com/problems/${slug}/` : null;
}

/** Rule-based problem picks from LeetCode starters + gaps */
function buildLeetcodeProblemPicks(lc, profile) {
  if (!lc) return [];
  const picks = [];
  const order = [...lc.uncoveredTopics, ...lc.weakTopics, ...profile.weakTopics.map((t) => t.name)];

  const seen = new Set();
  for (const topicName of order) {
    if (picks.length >= 6) break;
    if (seen.has(topicName)) continue;
    seen.add(topicName);
    const road = lc.topicRoadmap.find((r) => r.topic === topicName);
    const starters = TOPIC_STARTERS[topicName] || TOPIC_STARTERS.Arrays;
    const diff = road?.startWith || 'Easy';
    const starter = starters.find((p) => p.difficulty === diff) || starters[0];
    const count = road?.toSolveThisWeek || 3;

    picks.push({
      title: starter.title,
      topic: topicName,
      difficulty: starter.difficulty,
      pattern: road?.status === 'not_covered' ? 'Start here — topic not covered yet' : 'Close your gap',
      why: road?.status === 'not_covered'
        ? `You have fewer than ${UNCOVERED_THRESHOLD} tracked problems on ${topicName}. Solve ${count} Easy problems this week.`
        : `Need ~${road?.gap || 5} more on ${topicName} for placement readiness.`,
      companyRelevance: profile.targetCompany,
      leetcodeUrl: leetcodeUrl(starter.slug),
      problemsToSolve: count,
    });
  }
  return picks;
}

module.exports = {
  fetchUserStats,
  fetchRecentAcSubmissions,
  fetchQuestionTopics,
  mapTagsToDashboardTopics,
  enrichSubmissionsWithTopics,
  buildLeetcodeInsights,
  buildLeetcodeProblemPicks,
  leetcodeUrl,
  TOPIC_STARTERS,
};
