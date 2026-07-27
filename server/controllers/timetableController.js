const Subject = require('../models/Subject');
const { createSubject } = require('../services/subjectService');
const { parseTimetablePDF } = require('../services/timetableImportService');

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
    const subject = await createSubject(
      { name, code, instructor, credits, schedule },
      req.user.id
    );
    // Sharing createSubject with the AI path means this route now rejects a
    // duplicate name instead of silently creating a second copy.
    if (subject.skipped) {
      return res.status(409).json({ message: `Subject "${subject.name}" already exists.` });
    }
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

// POST /api/subjects/import-pdf — parse only, nothing is written yet
exports.importSubjectsFromPDF = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No PDF uploaded.' });
  try {
    const { entries, flagged } = await parseTimetablePDF(req.file.buffer);
    res.json({ entries, flagged });
  } catch (err) {
    // The service marks user-fixable failures with a code; everything else is ours.
    if (err.code === 'NO_TEXT' || err.code === 'NO_TIMETABLE' || err.code === 'UNREADABLE_PDF') {
      return res.status(422).json({ message: err.message, hint: err.hint });
    }
    console.error('Timetable import error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// POST /api/subjects/import-pdf/confirm — write the reviewed entries
exports.confirmImportedSubjects = async (req, res) => {
  try {
    const created = [];
    const skipped = [];
    for (const entry of req.body.subjects) {
      const result = await createSubject(entry, req.user.id);
      if (result.skipped) skipped.push(result.name);
      else created.push(result);
    }
    res.status(201).json({
      message: `Imported ${created.length} subject(s).`,
      subjects: created,
      skipped,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
