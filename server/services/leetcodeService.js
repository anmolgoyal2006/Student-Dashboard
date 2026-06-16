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

/** All accepted submission slugs (best-effort public API). */
async function fetchSolvedSlugs(username) {
  const slugs = new Set();

  const acQuery = `
    query acSubmissionList($username: String!, $limit: Int!) {
      matchedUser(username: $username) {
        acSubmissionList(limit: $limit) {
          titleSlug
        }
      }
    }
  `;
  try {
    const data = await lcQuery(acQuery, { username, limit: 500 });
    for (const s of data?.matchedUser?.acSubmissionList || []) {
      if (s.titleSlug) slugs.add(s.titleSlug);
    }
  } catch {
    /* fall through */
  }

  const listQuery = `
    query submissionList($username: String!, $limit: Int!, $offset: Int!) {
      submissionList(username: $username, limit: $limit, offset: $offset) {
        hasNext
        submissions {
          titleSlug
          statusDisplay
        }
      }
    }
  `;
  try {
    let offset = 0;
    const limit = 20;
    for (let page = 0; page < 40; page++) {
      const data = await lcQuery(listQuery, { username, limit, offset });
      const block = data?.submissionList;
      const subs = block?.submissions || [];
      for (const s of subs) {
        if ((s.statusDisplay || '').toLowerCase() === 'accepted' && s.titleSlug) {
          slugs.add(s.titleSlug);
        }
      }
      offset += limit;
      if (!block?.hasNext || subs.length < limit) break;
      await new Promise((r) => setTimeout(r, 80));
    }
  } catch {
    /* fall through */
  }

  const recent = await fetchRecentAcSubmissions(username, 50);
  for (const s of recent) {
    if (s.titleSlug) slugs.add(s.titleSlug);
  }

  return slugs;
}

function slugFromUrl(url) {
  if (!url) return null;
  const m = String(url).match(/leetcode\.com\/problems\/([^/]+)/);
  return m ? m[1] : null;
}

function getTopicProblemPool(topicName) {
  const easy = TOPIC_STARTERS[topicName] || [];
  const med = TOPIC_MEDIUM_PICKS[topicName] || [];
  const hard = TOPIC_HARD_PICKS[topicName] || [];
  const seen = new Set();
  return [...easy, ...med, ...hard].filter((p) => {
    if (!p.slug || seen.has(p.slug)) return false;
    seen.add(p.slug);
    return true;
  });
}

/** Pick first unsolved problem from curated pool for a topic. */
function pickUnsolvedForTopic(topicName, lcCount, totalSolved, solvedSlugs) {
  const pool = getTopicProblemPool(topicName);
  if (!pool.length) return null;

  const experienced = totalSolved >= 120 || lcCount >= 25;
  const prefer = experienced
    ? ['Medium', 'Hard', 'Easy']
    : lcCount < UNCOVERED_LC_COUNT
      ? ['Easy', 'Medium']
      : ['Medium', 'Easy', 'Hard'];

  for (const diff of prefer) {
    const hit = pool.find((p) => p.difficulty === diff && !solvedSlugs.has(p.slug));
    if (hit) return hit;
  }
  return pool.find((p) => !solvedSlugs.has(p.slug)) || null;
}

/** Dedupe and drop already-solved recommendations. */
function filterUnsolvedRecommendations(items, solvedSlugs) {
  const seen = new Set();
  return (items || []).filter((p) => {
    const slug = p.slug || slugFromUrl(p.leetcodeUrl) || null;
    if (!slug) return true;
    if (solvedSlugs.has(slug) || seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
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

const TOPIC_HARD_PICKS = {
  Arrays: [
    { title: 'Trapping Rain Water', slug: 'trapping-rain-water', difficulty: 'Hard' },
    { title: 'First Missing Positive', slug: 'first-missing-positive', difficulty: 'Hard' },
  ],
  Strings: [
    { title: 'Minimum Window Substring', slug: 'minimum-window-substring', difficulty: 'Hard' },
    { title: 'Substring with Concatenation of All Words', slug: 'substring-with-concatenation-of-all-words', difficulty: 'Hard' },
  ],
  'Linked Lists': [
    { title: 'Merge K Sorted Lists', slug: 'merge-k-sorted-lists', difficulty: 'Hard' },
  ],
  Trees: [
    { title: 'Binary Tree Maximum Path Sum', slug: 'binary-tree-maximum-path-sum', difficulty: 'Hard' },
    { title: 'Serialize and Deserialize Binary Tree', slug: 'serialize-and-deserialize-binary-tree', difficulty: 'Hard' },
  ],
  Graphs: [
    { title: 'Word Ladder II', slug: 'word-ladder-ii', difficulty: 'Hard' },
    { title: 'Alien Dictionary', slug: 'alien-dictionary', difficulty: 'Hard' },
  ],
  'Dynamic Programming': [
    { title: 'Edit Distance', slug: 'edit-distance', difficulty: 'Hard' },
    { title: 'Regular Expression Matching', slug: 'regular-expression-matching', difficulty: 'Hard' },
  ],
  'Recursion & Backtracking': [
    { title: 'N-Queens', slug: 'n-queens', difficulty: 'Hard' },
  ],
  Hashing: [
    { title: 'Subarray Sum Equals K', slug: 'subarray-sum-equals-k', difficulty: 'Medium' },
    { title: 'Longest Consecutive Sequence', slug: 'longest-consecutive-sequence', difficulty: 'Hard' },
  ],
  Greedy: [
    { title: 'Candy', slug: 'candy', difficulty: 'Hard' },
  ],
  'Sorting & Searching': [
    { title: 'Median of Two Sorted Arrays', slug: 'median-of-two-sorted-arrays', difficulty: 'Hard' },
  ],
  'Stacks & Queues': [
    { title: 'Largest Rectangle in Histogram', slug: 'largest-rectangle-in-histogram', difficulty: 'Hard' },
  ],
  Tries: [
    { title: 'Word Search II', slug: 'word-search-ii', difficulty: 'Hard' },
  ],
};

const COMPANY_PROBLEMS = {
  Google: {
    Arrays: [
      { title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', frequency: 'high' },
      { title: '3Sum', slug: '3sum', difficulty: 'Medium', frequency: 'high' },
      { title: 'Product of Array Except Self', slug: 'product-of-array-except-self', difficulty: 'Medium', frequency: 'high' },
    ],
    'Dynamic Programming': [
      { title: 'Longest Increasing Subsequence', slug: 'longest-increasing-subsequence', difficulty: 'Medium', frequency: 'high' },
      { title: 'Coin Change', slug: 'coin-change', difficulty: 'Medium', frequency: 'medium' },
    ],
    Graphs: [
      { title: 'Number of Islands', slug: 'number-of-islands', difficulty: 'Medium', frequency: 'high' },
      { title: 'Course Schedule', slug: 'course-schedule', difficulty: 'Medium', frequency: 'medium' },
    ],
  },
  Amazon: {
    Arrays: [
      { title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', frequency: 'high' },
      { title: 'Best Time to Buy and Sell Stock', slug: 'best-time-to-buy-and-sell-stock', difficulty: 'Easy', frequency: 'high' },
      { title: 'Container With Most Water', slug: 'container-with-most-water', difficulty: 'Medium', frequency: 'medium' },
    ],
    'Linked Lists': [
      { title: 'Reverse Linked List', slug: 'reverse-linked-list', difficulty: 'Easy', frequency: 'high' },
      { title: 'Merge Two Sorted Lists', slug: 'merge-two-sorted-lists', difficulty: 'Easy', frequency: 'high' },
    ],
    Trees: [
      { title: 'Invert Binary Tree', slug: 'invert-binary-tree', difficulty: 'Easy', frequency: 'high' },
      { title: 'Maximum Depth of Binary Tree', slug: 'maximum-depth-of-binary-tree', difficulty: 'Easy', frequency: 'high' },
    ],
  },
  Microsoft: {
    Arrays: [
      { title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', frequency: 'high' },
      { title: 'Rotate Array', slug: 'rotate-array', difficulty: 'Medium', frequency: 'medium' },
    ],
    Strings: [
      { title: 'Valid Palindrome', slug: 'valid-palindrome', difficulty: 'Easy', frequency: 'high' },
      { title: 'Longest Palindromic Substring', slug: 'longest-palindromic-substring', difficulty: 'Medium', frequency: 'medium' },
    ],
    Trees: [
      { title: 'Validate Binary Search Tree', slug: 'validate-binary-search-tree', difficulty: 'Medium', frequency: 'high' },
    ],
  },
  Meta: {
    Arrays: [
      { title: 'Product of Array Except Self', slug: 'product-of-array-except-self', difficulty: 'Medium', frequency: 'high' },
      { title: 'Merge Intervals', slug: 'merge-intervals', difficulty: 'Medium', frequency: 'high' },
    ],
    Graphs: [
      { title: 'Clone Graph', slug: 'clone-graph', difficulty: 'Medium', frequency: 'medium' },
    ],
    'Dynamic Programming': [
      { title: 'House Robber', slug: 'house-robber', difficulty: 'Medium', frequency: 'medium' },
    ],
  },
  Apple: {
    Arrays: [
      { title: 'Contains Duplicate', slug: 'contains-duplicate', difficulty: 'Easy', frequency: 'high' },
      { title: 'Missing Number', slug: 'missing-number', difficulty: 'Easy', frequency: 'high' },
    ],
    Trees: [
      { title: 'Same Tree', slug: 'same-tree', difficulty: 'Easy', frequency: 'medium' },
    ],
  },
  Other: {
    Arrays: [
      { title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', frequency: 'high' },
      { title: 'Contains Duplicate', slug: 'contains-duplicate', difficulty: 'Easy', frequency: 'high' },
    ],
    Strings: [
      { title: 'Valid Anagram', slug: 'valid-anagram', difficulty: 'Easy', frequency: 'high' },
    ],
  },
};

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
  let solvedSlugs = new Set(career.leetcodeSync?.solvedSlugs || []);

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
      solvedSlugs = await fetchSolvedSlugs(username);
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
    solvedSlugs: [...solvedSlugs],
    solvedCount: solvedSlugs.size,
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

/** Rule-based problem picks — only problems not in solvedSlugs */
function buildLeetcodeProblemPicks(lc, profile) {
  if (!lc) return [];
  const solvedSlugs = new Set(lc.solvedSlugs || []);
  const picks = [];
  const order = [
    ...lc.weakTopics,
    ...lc.uncoveredTopics,
    ...lc.topicRoadmap
      .filter((r) => r.status === 'building')
      .sort((a, b) => b.gap - a.gap)
      .map((r) => r.topic),
  ];

  const usedSlugs = new Set();

  for (const topicName of order) {
    if (picks.length >= 6) break;

    const road = lc.topicRoadmap.find((r) => r.topic === topicName);
    const lcCount = road?.lcCount ?? 0;
    if (road?.status === 'strong') continue;

    const starter = pickUnsolvedForTopic(
      topicName,
      lcCount,
      lc.totalSolved,
      new Set([...solvedSlugs, ...usedSlugs])
    );
    if (!starter) continue;
    usedSlugs.add(starter.slug);

    const count = road?.toSolveThisWeek || 2;

    picks.push({
      title: starter.title,
      slug: starter.slug,
      topic: topicName,
      difficulty: starter.difficulty,
      pattern: 'Not in your LeetCode AC list yet',
      why: `You haven't solved this on LeetCode (${lcCount} on ${topicName} tag). ${starter.difficulty} pick for ${profile.targetCompany}.`,
      companyRelevance: profile.targetCompany,
      leetcodeUrl: leetcodeUrl(starter.slug),
      problemsToSolve: count,
    });
  }
  return filterUnsolvedRecommendations(picks, solvedSlugs);
}

module.exports = {
  fetchUserStats,
  fetchSkillTagCounts,
  fetchRecentAcSubmissions,
  fetchSolvedSlugs,
  fetchQuestionTopics,
  mapTagsToDashboardTopics,
  aggregateTagsToDashboardTopics,
  applyLeetcodeTopicsToDsaTopics,
  enrichSubmissionsWithTopics,
  buildLeetcodeInsights,
  buildLeetcodeProblemPicks,
  filterUnsolvedRecommendations,
  pickUnsolvedForTopic,
  slugFromUrl,
  leetcodeUrl,
  TOPIC_STARTERS,
  COMPANY_PROBLEMS,
  UNCOVERED_LC_COUNT,
};
