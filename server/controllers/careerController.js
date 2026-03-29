const CareerProgress = require('../models/CareerProgress');

const DSA_TOPICS = [
  'Arrays', 'Strings', 'Linked Lists', 'Stacks & Queues',
  'Trees', 'Graphs', 'Dynamic Programming', 'Recursion & Backtracking',
  'Sorting & Searching', 'Hashing', 'Greedy', 'Tries',
];

// GET /api/career
exports.getCareer = async (req, res) => {
  try {
    let career = await CareerProgress.findOne({ userId: req.user.id });
    if (!career) {
      // Auto-create with default DSA topics
      career = await CareerProgress.create({
        userId: req.user.id,
        dsaTopics: DSA_TOPICS.map(name => ({ name, completed: false, problems: 0 })),
      });
    }
    res.json({ career });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/career
exports.updateCareer = async (req, res) => {
  try {
    const { targetCompany, targetRole, skills, dsaTopics, problemsSolved } = req.body;

    // Recalculate readiness
    const problems = problemsSolved ?? 0;
    let readiness = 'Beginner';
    if (problems >= 200) readiness = 'Ready';
    else if (problems >= 100) readiness = 'Intermediate';

    const career = await CareerProgress.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { targetCompany, targetRole, skills, dsaTopics, problemsSolved, readiness } },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ message: 'Career progress updated', career });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/career/topic/:topicName
exports.updateTopic = async (req, res) => {
  const { completed, problems } = req.body;
  try {
    const career = await CareerProgress.findOneAndUpdate(
      { userId: req.user.id, 'dsaTopics.name': req.params.topicName },
      {
        $set: {
          'dsaTopics.$.completed': completed,
          'dsaTopics.$.problems':  problems,
        },
      },
      { new: true }
    );
    res.json({ message: 'Topic updated', career });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
