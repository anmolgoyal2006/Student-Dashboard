const express = require('express');
const router  = express.Router();
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { VALID_GRADES } = require('../config/gradeConfig');
const {
  addMarks,
  getAllMarks,
  getCGPA,
  deleteMarks,
  getGradeOptions,
  getSemesters,
  getCGPAbySemester,
  addSemester,
  updateSemester,
  deleteSemester,
  addManualSGPA,
  savePdf,
  getSavedPdfs,
  downloadSavedPdf,
  deleteSavedPdf,
} = require('../controllers/marksController');

const { protect } = require('../middleware/authMiddleware');

// 🔥 NEW (FIXED)
const {
  uploadPdfHandler,
  parsePdfsHandler,
  generateLeaderboardHandler,
  generateSgpaLeaderboardHandler,
  ocrAiCorrectHandler,
  ocrReviewGenerateHandler,
  parseSavedPdfById,
} = require('../controllers/marksUploadController');
const multer = require('multer');
// Files are buffered in RAM, so the size cap must be enforced here — a check
// inside the controller runs only after the whole upload is already resident.
// /parse-pdfs accepts 20 files, so the effective ceiling is 20 × 10 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/pdf' ||
      /\.pdf$/i.test(file.originalname);
    cb(ok ? null : new Error('Only PDF files are allowed.'), ok);
  },
});

router.use(protect);

const subjectItemFields = (prefix) => [
  body(`${prefix}.*.name`).notEmpty().withMessage('Subject name is required in each subject.'),
  body(`${prefix}.*.credits`).isFloat({ gt: 0 }).withMessage('Credits must be greater than 0.'),
  body(`${prefix}.*.grade`).isIn(VALID_GRADES).withMessage('Invalid grade.'),
];

// Saved PDFs routes
router.post('/saved-pdfs', upload.single('file'), validate([
  body('name').trim().notEmpty().withMessage('Custom save name is required.'),
]), savePdf);
router.get('/saved-pdfs',      getSavedPdfs);
router.get('/saved-pdfs/:id',  validate([param('id').isMongoId()]), downloadSavedPdf);
router.delete('/saved-pdfs/:id', validate([param('id').isMongoId()]), deleteSavedPdf);

// existing routes
router.post('/', validate([
  body('subjectId').notEmpty().isMongoId().withMessage('subjectId must be a valid id.'),
  body('examType').isIn(['midterm', 'final', 'quiz', 'assignment', 'practical']).withMessage('Invalid exam type.'),
  body('marksObtained').isFloat({ min: 0 }).withMessage('marksObtained must be >= 0.'),
  body('maxMarks').isFloat({ min: 1 }).withMessage('maxMarks must be >= 1.'),
  body('examDate').optional().isISO8601(),
]), addMarks);
router.get('/',           getAllMarks);
router.get('/cgpa',       getCGPA);
router.delete('/:id',     validate([param('id').isMongoId()]), deleteMarks);

// semester routes
router.get('/grade-options',     getGradeOptions);
router.get('/semesters',         getSemesters);
router.get('/cgpa-semester',     getCGPAbySemester);

router.post('/semester', validate([
  body('semesterNumber').isInt({ min: 1 }).withMessage('Semester number must be at least 1.'),
  body('semesterName').optional().isString(),
  body('subjects').isArray({ min: 1 }).withMessage('subjects array is required'),
  ...subjectItemFields('subjects'),
]), addSemester);

router.post('/semester/manual', validate([
  body('semesterNumber').notEmpty().isInt({ min: 1 }).withMessage('Semester number is required'),
  body('semesterName').optional().isString(),
  body('sgpa').isFloat({ min: 0, max: 10 }).withMessage('SGPA must be between 0 and 10'),
  body('semCredits').optional().isFloat({ gt: 0 }),
]), addManualSGPA);

router.put('/semester/:id', validate([
  param('id').isMongoId(),
  body('semesterNumber').optional().isInt({ min: 1 }),
  body('semesterName').optional().isString(),
  body('subjects').optional().isArray(),
  ...subjectItemFields('subjects').map((chain) => chain.optional()),
]), updateSemester);

router.delete('/semester/:id', validate([param('id').isMongoId()]), deleteSemester);

// PDF leaderboard
router.post('/upload-pdf', upload.single('file'), uploadPdfHandler);
router.post('/parse-pdfs', upload.array('files', 20), parsePdfsHandler);
router.post('/saved-pdfs/:id/parse', validate([param('id').isMongoId()]), parseSavedPdfById);
router.post('/generate-leaderboard', validate([
  body('sources').exists().withMessage('sources array is required.'),
]), generateLeaderboardHandler);
router.post('/generate-sgpa-leaderboard', validate([
  body('sources').exists().withMessage('sources array is required.'),
]), generateSgpaLeaderboardHandler);

// OCR review & AI correction
router.post('/ocr-ai-correct', validate([
  body('students').isArray({ min: 1 }).withMessage('students array is required.'),
]), ocrAiCorrectHandler);
router.post('/ocr-review-generate', validate([
  body('sources').isArray({ min: 1 }).withMessage('sources array is required.'),
  body('correctedGrades').optional().isArray(),
]), ocrReviewGenerateHandler);

module.exports = router;
