const Marks   = require('../models/Marks');
const Subject = require('../models/Subject');

// POST /api/marks
exports.addMarks = async (req, res) => {
  const { subjectId, examType, marksObtained, maxMarks, examDate } = req.body;
  try {
    const mark = await Marks.create({
      userId: req.user.id,
      subjectId, examType, marksObtained, maxMarks, examDate,
    });
    res.status(201).json({ message: 'Marks added', mark });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/marks
exports.getAllMarks = async (req, res) => {
  try {
    const marks = await Marks.find({ userId: req.user.id })
      .populate('subjectId', 'name code credits')
      .sort({ examDate: -1 });
    res.json({ marks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/marks/cgpa
exports.getCGPA = async (req, res) => {
  try {
    const marks = await Marks.find({
      userId:   req.user.id,
      examType: 'final',
    }).populate('subjectId', 'name code credits');

    if (!marks.length)
      return res.json({ cgpa: 0, breakdown: [], message: 'No final exam marks found yet.' });

    let totalWeighted = 0;
    let totalCredits  = 0;

    const breakdown = marks.map(m => {
      const credits = m.subjectId?.credits || 3;
      totalWeighted += m.gradePoint * credits;
      totalCredits  += credits;
      return {
        subject:    m.subjectId?.name || 'Unknown',
        code:       m.subjectId?.code || '',
        credits,
        gradePoint: m.gradePoint,
        percentage: +((m.marksObtained / m.maxMarks) * 100).toFixed(1),
      };
    });

    const cgpa = totalCredits ? +(totalWeighted / totalCredits).toFixed(2) : 0;
    res.json({ cgpa, totalCredits, breakdown });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/marks/:id
exports.deleteMarks = async (req, res) => {
  try {
    await Marks.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ message: 'Marks deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
