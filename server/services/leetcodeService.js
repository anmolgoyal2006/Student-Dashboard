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

/**
 * LeetCode skill stats — problems solved per tag (fundamental / intermediate / advanced).
 */
async function fetchSkillTagCounts(username) {
  const query = `
    query skillStats($username: String!) {
      matchedUser(username: $username) {
        tagProblemCounts {
          fundamental { tagName tagSlug problemsSolved }
          intermediate { tagName tagSlug problemsSolved }
          advanced { tagName tagSlug problemsSolved }
        }
      }
    }
  `;
  const data = await lcQuery(query, { username });
  const counts = data?.matchedUser?.tagProblemCounts;
  if (!counts) return [];

  const rows = [];
  for (const tier of ['fundamental', 'intermediate', 'advanced']) {
    for (const row of counts[tier] || []) {
      if (row?.tagSlug) rows.push(row);
    }
  }
  return rows;
}

/** Max problems per dashboard topic from LeetCode tag rows (avoids double-counting). */
function aggregateTagsToDashboardTopics(tagRows) {
  const byTopic = {};
  for (const row of tagRows) {
    const topics = mapTagsToDashboardTopics([
      { slug: row.tagSlug, name: row.tagName },
    ]);
    const n = row.problemsSolved || 0;
    for (const topic of topics) {
      byTopic[topic] = Math.max(byTopic[topic] || 0, n);
    }
  }
  return byTopic;
}

/**
 * Merge LeetCode tag counts into dsaTopics (source of truth when linked).
 */
function applyLeetcodeTopicsToDsaTopics(dsaTopics, lcByTopic, topicTargets = {}) {
  if (!dsaTopics?.length) return dsaTopics;

  return dsaTopics.map((t) => {
    const lcCount = lcByTopic[t.name] || 0;
    const target = topicTargets[t.name] || 30;
    const problems = Math.max(t.problems || 0, lcCount);
    const completed = problems >= Math.min(target, Math.ceil(target * 0.6));
    return { ...t.toObject?.() || t, name: t.name, problems, completed };
  });
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

/** Min LeetCode tag count to treat a topic as "started" */
const LC_TOPIC_STARTED = 8;
/** Below this vs target = weak; below STARTED = not covered */
const UNCOVERED_LC_COUNT = 5;

const TOPIC_MEDIUM_PICKS = {
  Arrays: [
    { title: '3Sum', slug: '3sum', difficulty: 'Medium' },
    { title: 'Product of Array Except Self', slug: 'product-of-array-except-self', difficulty: 'Medium' },
  ],
  Strings: [
    { title: 'Longest Substring Without Repeating Characters', slug: 'longest-substring-without-repeating-characters', difficulty: 'Medium' },
  ],
  'Linked Lists': [
    { title: 'Reorder List', slug: 'reorder-list', difficulty: 'Medium' },
  ],
  Trees: [
    { title: 'Validate Binary Search Tree', slug: 'validate-binary-search-tree', difficulty: 'Medium' },
  ],
  Graphs: [
    { title: 'Course Schedule', slug: 'course-schedule', difficulty: 'Medium' },
  ],
  'Dynamic Programming': [
    { title: 'Longest Increasing Subsequence', slug: 'longest-increasing-subsequence', difficulty: 'Medium' },
  ],
  'Recursion & Backtracking': [
    { title: 'Combination Sum', slug: 'combination-sum', difficulty: 'Medium' },
  ],
  Hashing: [
    { title: 'Group Anagrams', slug: 'group-anagrams', difficulty: 'Medium' },
  ],
  Greedy: [
    { title: 'Jump Game II', slug: 'jump-game-ii', difficulty: 'Medium' },
  ],
  Tries: [
    { title: 'Design Add and Search Words Data Structure', slug: 'design-add-and-search-words-data-structure', difficulty: 'Medium' },
  ],
  'Sorting & Searching': [
    { title: 'Find Peak Element', slug: 'find-peak-element', difficulty: 'Medium' },
  ],
  'Stacks & Queues': [
    { title: 'Daily Temperatures', slug: 'daily-temperatures', difficulty: 'Medium' },
  ],
};

function pickProblemForTopic(topicName, lcCount, totalSolved) {
  const experienced = totalSolved >= 120 || lcCount >= 25;
  const intermediate = totalSolved >= 50 || lcCount >= LC_TOPIC_STARTED;

  if (experienced) {
    const picks = TOPIC_MEDIUM_PICKS[topicName] || TOPIC_STARTERS[topicName];
    return picks?.find((p) => p.difficulty === 'Medium') || picks?.[0];
  }
  if (intermediate) {
    const starters = TOPIC_STARTERS[topicName] || TOPIC_STARTERS.Arrays;
    return starters.find((p) => p.difficulty === 'Medium') || starters[starters.length - 1];
  }
  const starters = TOPIC_STARTERS[topicName] || TOPIC_STARTERS.Arrays;
  return starters.find((p) => p.difficulty === 'Easy') || starters[0];
}

function topicStatusFromCounts(lcCount, target, totalSolved) {
  const solved = lcCount;
  const gap = Math.max(0, target - solved);
  const pct = target > 0 ? solved / target : 0;

  if (lcCount < UNCOVERED_LC_COUNT) {
    return { status: 'not_covered', gap, startWith: 'Easy', toSolveThisWeek: 4, priority: 'high' };
  }
  if (pct < 0.45 || (totalSolved >= 150 && lcCount < target * 0.35)) {
    return {
      status: 'weak',
      gap,
      startWith: totalSolved >= 100 ? 'Medium' : 'Easy',
      toSolveThisWeek: 3,
      priority: 'medium',
    };
  }
  if (pct >= 0.85) {
    return { status: 'strong', gap, startWith: 'Hard', toSolveThisWeek: 1, priority: 'low' };
  }
  return { status: 'building', gap, startWith: 'Medium', toSolveThisWeek: 2, priority: 'low' };
}

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
  let lcByTopic = { ...(career.leetcodeSync?.topicCounts || {}) };

  let recentSolves = [];

  if (live) {
    try {
      const stats = await fetchUserStats(username);
      easy = stats.easy;
      medium = stats.medium;
      hard = stats.hard;
      totalSolved = stats.totalSolved;
      const tagRows = await fetchSkillTagCounts(username);
      lcByTopic = aggregateTagsToDashboardTopics(tagRows);
      const recent = await fetchRecentAcSubmissions(username, 25);
      const enriched = await enrichSubmissionsWithTopics(recent.slice(0, 8), 8);
      recentSolves = enriched.map((s) => ({
        title: s.title,
        slug: s.titleSlug,
        topics: s.topics || [],
      }));
    } catch (err) {
      console.warn('[LeetCode insights]', err.message);
    }
  }

  const topicRoadmap = (career.dsaTopics || []).map((t) => {
    const lcCount = lcByTopic[t.name] ?? 0;
    const solved = Math.max(t.problems || 0, lcCount);
    const target = topicTargets[t.name] || 30;
    const meta = topicStatusFromCounts(lcCount, target, totalSolved);

    return {
      topic: t.name,
      status: meta.status,
      solved,
      lcCount,
      target,
      gap: meta.gap,
      toSolveThisWeek: meta.toSolveThisWeek,
      startWith: meta.startWith,
      priority: meta.priority,
      recentOnLeetcode: lcCount,
    };
  });

  const uncoveredTopics = topicRoadmap
    .filter((t) => t.status === 'not_covered')
    .map((t) => t.topic);
  const weakTopics = topicRoadmap
    .filter((t) => t.status === 'weak')
    .sort((a, b) => b.gap - a.gap)
    .map((t) => t.topic);
  const easyRatio = totalSolved > 0 ? Math.round((easy / totalSolved) * 100) : 0;

  let difficultyAdvice = '';
  if (totalSolved >= 150) {
    if (hard < 25) {
      difficultyAdvice = `Strong profile (${totalSolved} solved). Focus on Hard problems and company-tagged Mediums — skip beginner Easy unless a topic is truly new.`;
    } else {
      difficultyAdvice = `Excellent volume (${totalSolved} solved). Maintain with 1–2 Medium/Hard daily on weakest tags.`;
    }
  } else if (totalSolved < 50 || easyRatio < 35) {
    difficultyAdvice = 'Build foundation with Easy on topics under 5 LeetCode solves, then Medium.';
  } else if (hard < 10 && totalSolved > 80) {
    difficultyAdvice = 'Add 1–2 Hard problems per week on your strongest topics.';
  } else {
    difficultyAdvice = 'Balance: mostly Medium on weak tags, occasional Hard.';
  }

  const dailyProblemTarget = totalSolved >= 200 ? 1 : totalSolved >= 100 ? 2 : 3;

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
    topicCounts: lcByTopic,
    recentSolves: recentSolves.slice(0, 8),
    recentTitles: recentSolves.map((s) => s.title),
    difficultyAdvice,
    dailyProblemTarget,
    linked: true,
  };
}

function leetcodeUrl(slug) {
  return slug ? `https://leetcode.com/problems/${slug}/` : null;
}

/** Rule-based problem picks — respects real LeetCode tag counts */
function buildLeetcodeProblemPicks(lc, profile) {
  if (!lc) return [];
  const picks = [];
  const order = [
    ...lc.weakTopics,
    ...lc.uncoveredTopics,
    ...lc.topicRoadmap
      .filter((r) => r.status === 'building')
      .sort((a, b) => b.gap - a.gap)
      .map((r) => r.topic),
  ];

  const seen = new Set();
  const recentSlugs = new Set(
    (lc.recentSolves || []).map((s) => s.slug).filter(Boolean)
  );

  for (const topicName of order) {
    if (picks.length >= 6) break;
    if (seen.has(topicName)) continue;
    seen.add(topicName);

    const road = lc.topicRoadmap.find((r) => r.topic === topicName);
    const lcCount = road?.lcCount ?? 0;
    if (road?.status === 'strong') continue;

    let starter = pickProblemForTopic(topicName, lcCount, lc.totalSolved);
    if (starter?.slug && recentSlugs.has(starter.slug)) {
      const alt = (TOPIC_MEDIUM_PICKS[topicName] || TOPIC_STARTERS[topicName] || [])
        .find((p) => p.slug !== starter.slug);
      if (alt) starter = alt;
    }

    const count = road?.toSolveThisWeek || 2;

    picks.push({
      title: starter.title,
      topic: topicName,
      difficulty: starter.difficulty,
      pattern: road?.status === 'not_covered'
        ? `Only ${lcCount} LeetCode solves on this tag — start here`
        : `${lcCount} on LeetCode — push ${starter.difficulty}`,
      why: road?.status === 'not_covered'
        ? `LeetCode shows ${lcCount} problems on ${topicName}. Solve ${count} ${starter.difficulty} this week.`
        : `You have ${lcCount} on ${topicName} vs ${road?.target} target — practice ${starter.difficulty} classics.`,
      companyRelevance: profile.targetCompany,
      leetcodeUrl: leetcodeUrl(starter.slug),
      problemsToSolve: count,
    });
  }
  return picks;
}

module.exports = {
  fetchUserStats,
  fetchSkillTagCounts,
  fetchRecentAcSubmissions,
  fetchQuestionTopics,
  mapTagsToDashboardTopics,
  aggregateTagsToDashboardTopics,
  applyLeetcodeTopicsToDsaTopics,
  enrichSubmissionsWithTopics,
  buildLeetcodeInsights,
  buildLeetcodeProblemPicks,
  leetcodeUrl,
  TOPIC_STARTERS,
};
