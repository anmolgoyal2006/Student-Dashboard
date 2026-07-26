const Subject = require('../models/Subject');

// GET /api/subjects
exports.getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({ userId: req.user.id }).sort({ name: 1 });
    res.json({ subjects });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/subjects
exports.addSubject = async (req, res) => {
  const { name, code, instructor, credits, schedule } = req.body;
  try {
    const subject = await Subject.create({
      userId: req.user.id,
      name, code, instructor, credits, schedule,
    });
    res.status(201).json({ message: 'Subject added', subject });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/subjects/:id
const SUBJECT_UPDATABLE_FIELDS = ['name', 'code', 'instructor', 'credits', 'schedule'];

exports.updateSubject = async (req, res) => {
  try {
    // Whitelist: $set: req.body would let a client reassign `userId` and move
    // the subject to another account.
    const updates = {};
    for (const field of SUBJECT_UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const subject = await Subject.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!subject) return res.status(404).json({ message: 'Subject not found.' });
    res.json({ message: 'Subject updated', subject });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/subjects/:id
exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!subject) return res.status(404).json({ message: 'Subject not found.' });
    res.json({ message: 'Subject deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
