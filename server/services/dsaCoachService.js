/**
 * AI DSA Coach — Groq-powered placement prep assistant.
 */

const Groq = require('groq-sdk');
const {
  buildLeetcodeInsights,
  buildLeetcodeProblemPicks,
} = require('./leetcodeService');

const groq = new Groq({ apiKey: process.env.GROQ_CHAT_KEY || process.env.GROQ_API_KEY });
const MODEL = 'llama-3.1-8b-instant';

const TOPIC_TARGETS = {
  Arrays: 50, Strings: 40, 'Linked Lists': 30, 'Stacks & Queues': 25,
  Trees: 40, Graphs: 35, 'Dynamic Programming': 45,
  'Recursion & Backtracking': 30, 'Sorting & Searching': 25,
  Hashing: 25, Greedy: 20, Tries: 15,
};

const COMPANY_FOCUS = {
  Amazon:    'Leadership principles, OOD, medium-hard DSA, bar-raiser depth',
  Google:    'Strong algorithms, graphs, DP, clean code under time pressure',
  Microsoft: 'Arrays, trees, system design basics, behavioral STAR stories',
  Flipkart:  'Practical DSA, Java-heavy stacks, e-commerce scale questions',
  Adobe:     'Core DS, creative problem solving',
  Infosys:   'Fundamentals, aptitude + basic-medium coding',
  TCS:       'NQT patterns, arrays, strings, time management',
  Other:     'Balanced DSA across all topics, mock interviews',
};

function extractJSON(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { /* */ }
  const fence = raw.replace(/```(?:json)?\s*([\s\S]*?)```/i, '$1').trim();
  try { return JSON.parse(fence); } catch { /* */ }
  const start = raw.search(/[\[{]/);
  if (start === -1) return null;
  const open = raw[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === open) depth++;
    else if (raw[i] === close) {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(raw.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

async function callGroq(system, user, maxTokens = 1800) {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0.35,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  return completion.choices[0]?.message?.content || '';
}

function buildProfile(career) {
  const topics = (career.dsaTopics || []).map((t) => ({
    name: t.name,
    problems: t.problems || 0,
    target: TOPIC_TARGETS[t.name] || 30,
    completed: !!t.completed,
    gap: Math.max(0, (TOPIC_TARGETS[t.name] || 30) - (t.problems || 0)),
    pct: Math.min(100, Math.round(((t.problems || 0) / (TOPIC_TARGETS[t.name] || 30)) * 100)),
  }));
  const weak = [...topics].filter((t) => t.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 5);
  const strong = topics.filter((t) => t.pct >= 70).map((t) => t.name);

  return {
    targetCompany: career.targetCompany || 'Other',
    targetRole: career.targetRole || 'Software Engineer',
    problemsSolved: career.problemsSolved || 0,
    readiness: career.readiness || 'Beginner',
    skills: (career.skills || []).join(', ') || 'Not specified',
    companyFocus: COMPANY_FOCUS[career.targetCompany] || COMPANY_FOCUS.Other,
    topics,
    weakTopics: weak,
    strongTopics: strong,
  };
}

function ruleBasedCoach(profile, lc) {
  const focus = profile.weakTopics[0];
  const lcPicks = buildLeetcodeProblemPicks(lc, profile);

  let dailyMission;
  if (lc?.topicRoadmap?.length) {
    const priorities = lc.topicRoadmap
      .filter((r) => r.status === 'not_covered' || r.status === 'weak')
      .slice(0, 3);
    dailyMission = priorities.map((r, i) => ({
      task: r.status === 'not_covered'
        ? `Solve ${Math.min(2, r.toSolveThisWeek)} ${r.startWith} ${r.topic} problems on LeetCode (topic not covered yet)`
        : `Solve ${r.toSolveThisWeek} ${r.topic} problems (${r.startWith} first)`,
      topic: r.topic,
      priority: i === 0 ? 'high' : 'medium',
      minutes: r.status === 'not_covered' ? 50 : 45,
      problemsCount: r.status === 'not_covered' ? 2 : r.toSolveThisWeek,
    }));
  } else {
    dailyMission = profile.weakTopics.slice(0, 3).map((t, i) => ({
      task: `Solve ${t.gap >= 15 ? 3 : 2} ${t.name} problems`,
      topic: t.name,
      priority: i === 0 ? 'high' : 'medium',
      minutes: 45,
      problemsCount: t.gap >= 15 ? 3 : 2,
    }));
  }

  const weeklyFocus = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
    const r = lc?.topicRoadmap?.[i % (lc.topicRoadmap.length || 1)]
      || profile.weakTopics[i % Math.max(1, profile.weakTopics.length)]
      || profile.topics[i % profile.topics.length];
    const topic = r?.topic || r?.name || 'Arrays';
    const count = r?.toSolveThisWeek || 3;
    const diff = r?.startWith || 'Easy';
    return {
      day,
      topic,
      goal: `Solve ${count} problems — ${diff} first on LeetCode`,
    };
  });

  const lcInsight = lc
    ? `LeetCode @${lc.username}: ${lc.totalSolved} solved (E${lc.easy}/M${lc.medium}/H${lc.hard}). ${
        lc.uncoveredTopics.length
          ? `Topics not covered yet: ${lc.uncoveredTopics.join(', ')} — start with Easy.`
          : 'Good topic spread — push Medium on weak areas.'
      } ${lc.difficultyAdvice}`
    : null;

  return {
    readinessInsight: lc
      ? `${lcInsight} Dashboard: ${profile.problemsSolved} total (${profile.readiness}).`
      : `You have solved ${profile.problemsSolved} problems (${profile.readiness}). ${
          focus ? `Biggest gap: ${focus.name} (${focus.problems}/${focus.target}).` : 'Great topic coverage!'
        }`,
    leetcodeInsight: lcInsight,
    companyFocus: profile.companyFocus,
    dailyMission,
    weeklyFocus,
    topicRoadmap: lc?.topicRoadmap || [],
    recommendedProblems: lcPicks.length
      ? lcPicks
      : profile.weakTopics.slice(0, 4).map((t) => ({
          title: `${t.name} — Pattern Review`,
          topic: t.name,
          difficulty: 'Medium',
          pattern: 'Core patterns',
          why: `Close ${t.gap} problem gap`,
          companyRelevance: profile.targetCompany,
          problemsToSolve: Math.min(5, t.gap),
        })),
    weakTopics: lc?.uncoveredTopics?.length
      ? [...lc.uncoveredTopics, ...lc.weakTopics]
      : profile.weakTopics.map((t) => t.name),
    strongTopics: profile.strongTopics,
    uncoveredTopics: lc?.uncoveredTopics || [],
    nextMilestone: profile.problemsSolved < 50 ? '50 problems (Beginner)' : profile.problemsSolved < 100 ? '100 problems (Intermediate)' : '200 problems (Ready)',
    studyTip: lc?.difficultyAdvice || 'Consistency beats cramming — 2 quality problems daily with review notes.',
    dailyProblemTarget: lc?.dailyProblemTarget || 2,
    placementScore: Math.min(100, Math.round((profile.problemsSolved / 200) * 100)),
    leetcodeLinked: !!lc,
  };
}

async function generateCoachPlan(career, options = {}) {
  const profile = buildProfile(career);
  const lc = await buildLeetcodeInsights(career, {
    live: options.liveLeetcode !== false && !!career.leetcodeUsername,
    topicTargets: TOPIC_TARGETS,
  });
  const base = ruleBasedCoach(profile, lc);

  if (!lc) {
    const system = `You are an expert placement DSA coach for Indian college students targeting ${profile.targetCompany}.
Return ONLY valid JSON, no markdown. Be specific, actionable, and encouraging.`;
    const user = `Student profile (no LeetCode linked — tell them to link LeetCode for better picks):
- Target: ${profile.targetCompany} — ${profile.targetRole}
- Problems solved: ${profile.problemsSolved} (${profile.readiness})
- Company expects: ${profile.companyFocus}

Topic progress (done/target):
${profile.topics.map((t) => `- ${t.name}: ${t.problems}/${t.target} (${t.pct}%)`).join('\n')}

Return JSON with dailyMission, weeklyFocus, recommendedProblems (5), weakTopics, strongTopics, readinessInsight, studyTip, placementScore, nextMilestone, companyFocus.
For uncovered topics (0-2 problems), recommend starting with Easy LeetCode classics by name.`;

    try {
      const raw = await callGroq(system, user, 2000);
      const parsed = extractJSON(raw);
      if (parsed?.dailyMission?.length) {
        return { ...base, ...parsed, source: 'ai', leetcodeLinked: false };
      }
    } catch (err) {
      console.error('[DSA Coach]', err.message);
    }
    return { ...base, source: 'rules', leetcodeLinked: false };
  }

  const system = `You are an expert placement DSA coach. The student linked LeetCode — use their REAL stats below.
Return ONLY valid JSON. Recommend real LeetCode-style problem titles. For topics marked not_covered, insist on Easy first.
Include problemsToSolve count per recommendation. Include leetcodeUrl when you know the slug (e.g. two-sum).`;

  const user = `Target: ${profile.targetCompany} — ${profile.targetRole}
LeetCode @${lc.username}: ${lc.totalSolved} total | Easy ${lc.easy} | Medium ${lc.medium} | Hard ${lc.hard} (${lc.easyRatio}% easy)
Advice: ${lc.difficultyAdvice}
Daily target: ${lc.dailyProblemTarget} problems/day

Topics NOT covered on LeetCode tracker (<3 problems): ${lc.uncoveredTopics.join(', ') || 'none'}
Weak topics: ${lc.weakTopics.join(', ') || 'none'}
Recent LeetCode solves: ${lc.recentSolves.map((s) => s.title).join(', ') || 'none fetched'}

Per-topic roadmap:
${lc.topicRoadmap.map((r) => `- ${r.topic}: ${r.solved}/${r.target}, status=${r.status}, solve ${r.toSolveThisWeek}/week, start ${r.startWith}`).join('\n')}

Dashboard topic progress:
${profile.topics.map((t) => `- ${t.name}: ${t.problems}/${t.target}`).join('\n')}

Return JSON:
{
  "readinessInsight": "2-3 sentences referencing LeetCode stats",
  "leetcodeInsight": "1 sentence on what to fix on LeetCode",
  "companyFocus": "...",
  "placementScore": 0-100,
  "dailyProblemTarget": ${lc.dailyProblemTarget},
  "dailyMission": [{"task":"...","topic":"...","priority":"high|medium|low","minutes":45,"problemsCount":2}],
  "weeklyFocus": [{"day":"Mon","topic":"...","goal":"solve N Easy/Medium on LeetCode"}],
  "topicRoadmap": [{"topic":"...","status":"not_covered|weak|building|strong","solved":0,"target":30,"toSolveThisWeek":5,"startWith":"Easy|Medium"}],
  "recommendedProblems": [{"title":"Two Sum","topic":"Arrays","difficulty":"Easy","pattern":"...","why":"...","companyRelevance":"${profile.targetCompany}","leetcodeUrl":"https://leetcode.com/problems/two-sum/","problemsToSolve":3}],
  "uncoveredTopics": ["..."],
  "weakTopics": ["..."],
  "strongTopics": ["..."],
  "nextMilestone": "...",
  "studyTip": "..."
}
3 dailyMission items, 7 weeklyFocus days, 6 recommendedProblems prioritizing uncovered topics with Easy first.`;

  try {
    const raw = await callGroq(system, user, 2400);
    const parsed = extractJSON(raw);
    if (parsed?.dailyMission?.length) {
      const merged = {
        ...base,
        ...parsed,
        source: 'ai+leetcode',
        leetcodeLinked: true,
        topicRoadmap: parsed.topicRoadmap?.length ? parsed.topicRoadmap : base.topicRoadmap,
        recommendedProblems: parsed.recommendedProblems?.length
          ? parsed.recommendedProblems.map((p) => ({
              ...p,
              leetcodeUrl: p.leetcodeUrl || (p.titleSlug ? `https://leetcode.com/problems/${p.titleSlug}/` : undefined),
            }))
          : base.recommendedProblems,
        uncoveredTopics: parsed.uncoveredTopics || base.uncoveredTopics,
      };
      return merged;
    }
  } catch (err) {
    console.error('[DSA Coach]', err.message);
  }

  return { ...base, source: 'rules+leetcode', leetcodeLinked: true };
}

async function generateTopicGuide(career, topicName) {
  const profile = buildProfile(career);
  const lc = await buildLeetcodeInsights(career, { live: false, topicTargets: TOPIC_TARGETS });
  const topic = profile.topics.find((t) => t.name === topicName) || { name: topicName, problems: 0, target: 30, gap: 30 };
  const road = lc?.topicRoadmap?.find((r) => r.topic === topicName);
  const startDiff = road?.startWith || (topic.problems < 3 ? 'Easy' : 'Medium');

  const system = 'You are a DSA mentor. Return ONLY valid JSON.';
  const user = `Topic: ${topicName}
Student: ${profile.problemsSolved} total problems, ${topic.problems}/${topic.target} on this topic
LeetCode: ${lc ? `@${lc.username}, ${lc.totalSolved} total, topic status: ${road?.status || 'unknown'}` : 'not linked'}
${road?.status === 'not_covered' ? 'IMPORTANT: Topic barely started — give 3 Easy LeetCode problems first with real titles and leetcode slugs in url field.' : ''}
Start difficulty: ${startDiff}
Target company: ${profile.targetCompany}

Return JSON:
{
  "summary": "2 sentences why this topic matters for ${profile.targetCompany}",
  "keyPatterns": ["pattern1", "pattern2", "pattern3"],
  "studyOrder": ["step1", "step2", "step3"],
  "commonMistakes": ["mistake1", "mistake2"],
  "problems": [
    {"title":"classic LeetCode name","difficulty":"Easy|Medium|Hard","pattern":"...","approach":"1-2 sentence hint","timeMins":25,"leetcodeUrl":"https://leetcode.com/problems/slug/"}
  ],
  "weekPlan": "how many ${startDiff} problems to solve this week (${road?.toSolveThisWeek || 5} recommended)"
}
Include exactly 4 problems; if topic not covered, all 4 should be Easy with real LeetCode titles.`;

  try {
    const raw = await callGroq(system, user, 1500);
    const parsed = extractJSON(raw);
    if (parsed?.problems?.length) return parsed;
  } catch (err) {
    console.error('[DSA Topic Guide]', err.message);
  }

  return {
    summary: `${topicName} is essential for ${profile.targetCompany} interviews. Focus on core patterns first.`,
    keyPatterns: ['Identify pattern', 'Practice templates', 'Time-boxed solving'],
    studyOrder: ['Learn 1 pattern', 'Solve 2 easy', 'Solve 2 medium'],
    commonMistakes: ['Skipping edge cases', 'Not analyzing complexity'],
    problems: [
      { title: `${topicName} Warm-up`, difficulty: 'Easy', pattern: 'Basics', approach: 'Brute force then optimize', timeMins: 20 },
      { title: `${topicName} Standard`, difficulty: 'Medium', pattern: 'Core pattern', approach: 'Use optimal data structure', timeMins: 30 },
    ],
    weekPlan: `Solve ${Math.min(5, topic.gap || 5)} problems this week`,
  };
}

async function parsePracticeLog(career, text) {
  const topicNames = (career.dsaTopics || []).map((t) => t.name).join(', ');

  const system = 'Parse student practice logs. Return ONLY valid JSON.';
  const user = `Known topics: ${topicNames}

Student wrote: "${text}"

Return JSON:
{
  "parsed": [{"topic":"exact topic from list or closest","count":1,"problemNames":["name if mentioned"]}],
  "totalNew": number,
  "encouragement": "short motivating line",
  "suggestedNext": "what to solve next"
}
If unclear, infer best matching topic. count = number of problems mentioned.`;

  try {
    const raw = await callGroq(system, user, 600);
    const parsed = extractJSON(raw);
    if (parsed?.parsed) return parsed;
  } catch (err) {
    console.error('[DSA Log]', err.message);
  }

  return {
    parsed: [{ topic: 'Arrays', count: 1, problemNames: [] }],
    totalNew: 1,
    encouragement: 'Logged! Keep the streak going.',
    suggestedNext: 'Pick your weakest topic from the coach plan.',
  };
}

async function getProblemHint(topic, problemTitle, studentAttempt = '') {
  const system = 'Give a Socratic hint only — do NOT give full solution code. Return JSON only.';
  const user = `Topic: ${topic}
Problem: ${problemTitle}
${studentAttempt ? `Student attempt/thoughts: ${studentAttempt}` : ''}

Return: {"hint":"2-3 sentence hint","nextStep":"one concrete next step","complexity":"expected O() if relevant"}`;

  try {
    const raw = await callGroq(system, user, 400);
    return extractJSON(raw) || { hint: 'Break the problem into smaller cases.', nextStep: 'Write pseudocode first.' };
  } catch {
    return { hint: 'Identify the pattern category first.', nextStep: 'Try brute force, then optimize.' };
  }
}

module.exports = {
  generateCoachPlan,
  generateTopicGuide,
  parsePracticeLog,
  getProblemHint,
  buildProfile,
  TOPIC_TARGETS,
};
