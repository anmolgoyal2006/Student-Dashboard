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

    const cgpa = totalCredits ? Math.round((totalWeighted / totalCredits + Number.EPSILON) * 100) / 100 : 0;
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


const { GRADE_OPTIONS } = require('../config/gradeConfig');
const Semester = require('../models/Semester.model');
const { calculateCGPA } = require('../utils/gradeUtils');

// GET /api/marks/grade-options
exports.getGradeOptions = (req, res) => {
  res.json({ gradeOptions: GRADE_OPTIONS });
};

// GET /api/marks/semesters
exports.getSemesters = async (req, res) => {
  try {
    const semesters = await Semester.find({ student: req.user.id }).sort({ semesterNumber: 1 });
    res.json({ semesters });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/marks/cgpa-semester
exports.getCGPAbySemester = async (req, res) => {
  try {
    const semesters = await Semester.find({ student: req.user.id }).sort({ semesterNumber: 1 });

    // Recalculate SGPAs from raw subject data (fixes old toFixed bugs in stored values)
    const { calculateSGPA } = require('../utils/gradeUtils');
    const sgpaList = semesters.map((s) =>
      s.isManual && s.directSGPA !== null ? s.directSGPA : calculateSGPA(s.subjects)
    );

    // Credit-weighted CGPA: Σ(SGPA × credits) / Σ(credits)
    // Only applies when every semester has credit data available
    const allHaveCredits = semesters.every((s) =>
      s.isManual ? (s.totalCredits != null && s.totalCredits > 0) : s.subjects?.length > 0
    );

    let cgpa;
    if (allHaveCredits) {
      let weightedSum = 0;
      let totalCreditsAll = 0;
      for (const s of semesters) {
        const sgpa = s.isManual && s.directSGPA !== null ? s.directSGPA : calculateSGPA(s.subjects);
        const cr = s.isManual ? s.totalCredits : s.subjects.reduce((a, b) => a + (b.credits || 0), 0);
        weightedSum += sgpa * cr;
        totalCreditsAll += cr;
      }
      cgpa = calculateCGPA.withWeightedTotal(weightedSum, totalCreditsAll);
    } else {
      cgpa = calculateCGPA(sgpaList);
    }

    res.json({ cgpa, sgpaList, totalSemesters: semesters.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/marks/semester
exports.addSemester = async (req, res) => {
  try {
    const { semesterNumber, semesterName, subjects } = req.body;
    if (!subjects || !Array.isArray(subjects) || subjects.length === 0)
      return res.status(400).json({ message: 'subjects array is required' });
    for (const s of subjects)
      if (!s.credits || s.credits <= 0)
        return res.status(400).json({ message: `Credits for "${s.name}" must be > 0` });

    const semester = new Semester({ student: req.user.id, semesterNumber, semesterName, subjects });
    await semester.save();
    res.status(201).json({ semester });
  } catch (err) {
    if (err.name === 'ValidationError')
      return res.status(400).json({ message: Object.values(err.errors).map(e => e.message).join('; ') });
    if (err.message.startsWith('Invalid grade'))
      return res.status(400).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/marks/semester/:id
exports.updateSemester = async (req, res) => {
  try {
    const semester = await Semester.findOne({ _id: req.params.id, student: req.user.id });
    if (!semester) return res.status(404).json({ message: 'Semester not found' });
    const { semesterNumber, semesterName, subjects } = req.body;
    if (semesterNumber !== undefined) semester.semesterNumber = semesterNumber;
    if (semesterName   !== undefined) semester.semesterName   = semesterName;
    if (subjects       !== undefined) semester.subjects       = subjects;
    await semester.save();
    res.json({ semester });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/marks/semester/manual
exports.addManualSGPA = async (req, res) => {
  try {
    const { semesterNumber, semesterName, sgpa, semCredits } = req.body;
  const sgpaNum = Number(sgpa);
    if (isNaN(sgpaNum) || sgpaNum < 0 || sgpaNum > 10)
      return res.status(400).json({ message: 'SGPA must be between 0 and 10' });
    if (!semesterNumber)
      return res.status(400).json({ message: 'Semester number is required' });

    const semester = new Semester({
      student: req.user.id,
      semesterNumber: Number(semesterNumber),
      semesterName,
      isManual: true,
      directSGPA: sgpaNum,
      totalCredits: semCredits ? Number(semCredits) : null,
      subjects: [],
    });
    await semester.save();
    res.status(201).json({ semester });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/marks/semester/:id
exports.deleteSemester = async (req, res) => {
  try {
    const deleted = await Semester.findOneAndDelete({ _id: req.params.id, student: req.user.id });
    if (!deleted) return res.status(404).json({ message: 'Semester not found' });
    res.json({ message: 'Semester deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const SavedPdf = require('../models/SavedPdf');

// POST /api/marks/saved-pdfs — Save a PDF document
exports.savePdf = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No PDF file uploaded.' });
    }
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Custom save name is required.' });
    }

    const saved = await SavedPdf.create({
      userId: req.user.id,
      name: name.trim(),
      fileName: req.file.originalname,
      fileData: req.file.buffer,
      contentType: req.file.mimetype || 'application/pdf',
    });

    res.status(201).json({
      message: 'PDF saved successfully.',
      pdf: {
        id: saved._id,
        name: saved.name,
        fileName: saved.fileName,
        createdAt: saved.createdAt,
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/marks/saved-pdfs — Get all saved PDFs (excluding binary data)
exports.getSavedPdfs = async (req, res) => {
  try {
    const pdfs = await SavedPdf.find({ userId: req.user.id })
      .select('-fileData')
      .sort({ createdAt: -1 });
    res.json({ pdfs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/marks/saved-pdfs/:id — Download a saved PDF
exports.downloadSavedPdf = async (req, res) => {
  try {
    const pdf = await SavedPdf.findOne({ _id: req.params.id, userId: req.user.id });
    if (!pdf) {
      return res.status(404).json({ message: 'Saved PDF not found.' });
    }

    res.setHeader('Content-Type', pdf.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.fileName}"`);
    res.send(pdf.fileData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/marks/saved-pdfs/:id — Delete a saved PDF
exports.deleteSavedPdf = async (req, res) => {
  try {
    const deleted = await SavedPdf.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) {
      return res.status(404).json({ message: 'Saved PDF not found.' });
    }
    res.json({ message: 'Saved PDF deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};