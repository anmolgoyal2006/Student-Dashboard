const CareerProgress = require('../models/CareerProgress');

const TOPIC_TARGETS = {
  'Arrays':                   50,
  'Strings':                  40,
  'Linked Lists':             30,
  'Stacks & Queues':          25,
  'Trees':                    40,
  'Graphs':                   35,
  'Dynamic Programming':      45,
  'Recursion & Backtracking': 30,
  'Sorting & Searching':      25,
  'Hashing':                  25,
  'Greedy':                   20,
  'Tries':                    15,
};

const TOTAL_TARGET  = 200;
const LEVEL_TARGETS = [
  { level: 'Beginner',     min: 0,   max: 49,       next: 'Intermediate', nextAt: 50  },
  { level: 'Intermediate', min: 50,  max: 99,       next: 'Advanced',     nextAt: 100 },
  { level: 'Advanced',     min: 100, max: 199,      next: 'Ready',        nextAt: 200 },
  { level: 'Ready',        min: 200, max: Infinity,  next: null,           nextAt: null },
];

const WEEKLY_ROTATION = [
  'Arrays', 'Strings', 'Trees',
  'Dynamic Programming', 'Graphs',
  'Stacks & Queues', 'Recursion & Backtracking',
];

// ── Helpers ───────────────────────────────────────────────────────────────

function getLevelInfo(problemsSolved) {
  return LEVEL_TARGETS.find(l => problemsSolved >= l.min && problemsSolved <= l.max)
    || LEVEL_TARGETS[0];
}

function getWeakestTopics(dsaTopics, count = 4) {
  // Use .toObject() or extract fields explicitly to avoid Mongoose doc issues
  return dsaTopics
    .map(t => {
      const name     = t.name || t._doc?.name || '';
      const problems = t.problems || t._doc?.problems || 0;
      const target   = TOPIC_TARGETS[name] || 30;
      const gap      = target - problems;
      return { name, problems, target, gap };
    })
    .filter(t => t.name && t.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, count);
}

function generateDailyTasks(weakTopics) {
  return weakTopics.map(t => {
    const count = t.gap >= 20 ? 5 : t.gap >= 10 ? 3 : 2;
    return {
      topic:  t.name,
      task:   `Solve ${count} ${t.name} problems`,
      count,
      target: t.target,
      done:   t.problems,
      gap:    t.gap,
    };
  });
}

function generateWeeklyPlan(dsaTopics) {
  const topicMap = {};
  dsaTopics.forEach(t => {
    const name = t.name || t._doc?.name || '';
    if (name) topicMap[name] = t.problems || 0;
  });

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((day, i) => {
    const topic  = WEEKLY_ROTATION[i % WEEKLY_ROTATION.length];
    const done   = topicMap[topic] || 0;
    const target = TOPIC_TARGETS[topic] || 30;
    const count  = done >= target ? 2 : 5;
    return { day, topic, task: `Solve ${count} ${topic} problems`, done, target };
  });
}

// ── GET /api/career/plan ──────────────────────────────────────────────────

exports.getCareerPlan = async (req, res) => {
  try {
    const career = await CareerProgress.findOne({ userId: req.user.id }).lean(); // ← .lean() converts to plain JS object
    if (!career) {
      return res.status(404).json({ message: 'No career data found. Set up your career profile first.' });
    }

    const { dsaTopics, problemsSolved = 0 } = career;

    const weakTopics    = getWeakestTopics(dsaTopics, 4);
    const dailyTasks    = generateDailyTasks(weakTopics);
    const weeklyPlan    = generateWeeklyPlan(dsaTopics);
    const levelInfo     = getLevelInfo(problemsSolved);

    const topicProgress = dsaTopics.map(t => ({
      name:   t.name,
      done:   t.problems || 0,
      target: TOPIC_TARGETS[t.name] || 30,
      pct:    Math.min(100, Math.round(((t.problems || 0) / (TOPIC_TARGETS[t.name] || 30)) * 100)),
    }));

    const progressStats = {
      problemsSolved,
      totalTarget:  TOTAL_TARGET,
      pct:          Math.min(100, Math.round((problemsSolved / TOTAL_TARGET) * 100)),
      currentLevel: levelInfo.level,
      nextLevel:    levelInfo.next,
      nextLevelAt:  levelInfo.nextAt,
      toNextLevel:  levelInfo.nextAt ? Math.max(0, levelInfo.nextAt - problemsSolved) : 0,
      levelPct:     levelInfo.nextAt
        ? Math.round(((problemsSolved - levelInfo.min) / (levelInfo.nextAt - levelInfo.min)) * 100)
        : 100,
    };

    const focusTopic = weakTopics[0]
      ? {
          name:   weakTopics[0].name,
          done:   weakTopics[0].problems,
          target: weakTopics[0].target,
          gap:    weakTopics[0].gap,
        }
      : null;

    res.json({ dailyTasks, weeklyPlan, progressStats, topicProgress, focusTopic });

  } catch (err) {
    console.error('[CareerPlan]', err.message);
    res.status(500).json({ message: err.message });
  }
};