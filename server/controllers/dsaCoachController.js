const CareerProgress = require('../models/CareerProgress');
const {
  generateCoachPlan,
  generateTopicGuide,
  parsePracticeLog,
  getProblemHint,
  TOPIC_TARGETS,
} = require('../services/dsaCoachService');

function recalcReadiness(problems) {
  if (problems >= 200) return 'Ready';
  if (problems >= 100) return 'Intermediate';
  return 'Beginner';
}

// POST /api/career/dsa/coach
exports.getDsaCoach = async (req, res) => {
  try {
    const career = await CareerProgress.findOne({ userId: req.user.id });
    if (!career) return res.status(404).json({ message: 'Set up career profile first.' });

    const force = req.body?.refresh === true;
    const cacheMs = 4 * 60 * 60 * 1000;
    const cached = career.dsaCoach?.generatedAt;
    const lcSyncAt = career.leetcodeSync?.lastSyncAt
      ? new Date(career.leetcodeSync.lastSyncAt).getTime()
      : 0;
    const coachAt = cached ? new Date(cached).getTime() : 0;
    const lcNewerThanCoach = lcSyncAt > coachAt;
    const fresh = cached && Date.now() - coachAt < cacheMs && !lcNewerThanCoach;

    if (fresh && !force && career.dsaCoach?.dailyMission?.length) {
      return res.json({ coach: career.dsaCoach, cached: true, career });
    }

    const coach = await generateCoachPlan(career, {
      liveLeetcode: force || lcNewerThanCoach || !cached,
    });
    coach.generatedAt = new Date();

    career.dsaCoach = coach;
    career.markModified('dsaCoach');
    await career.save();

    res.json({ coach, cached: false, career });
  } catch (err) {
    console.error('[DSA Coach]', err);
    res.status(500).json({ message: err.message || 'Failed to generate coach plan' });
  }
};

// POST /api/career/dsa/topic-guide
exports.getTopicGuide = async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ message: 'topic is required' });

    const career = await CareerProgress.findOne({ userId: req.user.id });
    if (!career) return res.status(404).json({ message: 'Career profile not found' });

    const guide = await generateTopicGuide(career, topic);
    res.json({ guide, topic });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/career/dsa/log-practice
exports.logPractice = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'Describe what you practiced' });

    const career = await CareerProgress.findOne({ userId: req.user.id });
    if (!career) return res.status(404).json({ message: 'Career profile not found' });

    const result = await parsePracticeLog(career, text.trim());
    let added = 0;

    for (const item of result.parsed || []) {
      const topicName = (career.dsaTopics || []).find(
        (t) => t.name.toLowerCase() === String(item.topic).toLowerCase()
      )?.name || item.topic;

      const idx = career.dsaTopics.findIndex((t) => t.name === topicName);
      if (idx === -1) continue;

      const count = Math.max(1, Number(item.count) || 1);
      career.dsaTopics[idx].problems = (career.dsaTopics[idx].problems || 0) + count;
      const target = TOPIC_TARGETS[topicName] || 30;
      if (career.dsaTopics[idx].problems >= target) {
        career.dsaTopics[idx].completed = true;
      }
      added += count;
    }

    career.problemsSolved = (career.problemsSolved || 0) + (result.totalNew || added);
    career.readiness = recalcReadiness(career.problemsSolved);

    if (!career.dsaSessions) career.dsaSessions = [];
    career.dsaSessions.unshift({
      date: new Date(),
      note: text.trim().slice(0, 500),
      problemsAdded: added,
      topics: (result.parsed || []).map((p) => p.topic),
      aiFeedback: result.encouragement,
    });
    if (career.dsaSessions.length > 30) {
      career.dsaSessions = career.dsaSessions.slice(0, 30);
    }

    career.markModified('dsaTopics');
    career.markModified('dsaSessions');
    await career.save();

    res.json({
      message: `Logged ${added} problem(s)`,
      result,
      added,
      career,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/career/dsa/hint
exports.getHint = async (req, res) => {
  try {
    const { topic, problemTitle, attempt } = req.body;
    if (!topic || !problemTitle) {
      return res.status(400).json({ message: 'topic and problemTitle required' });
    }
    const hint = await getProblemHint(topic, problemTitle, attempt || '');
    res.json({ hint });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
