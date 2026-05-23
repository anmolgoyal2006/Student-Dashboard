const express = require('express');
const router  = express.Router();
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
} = require('../controllers/marksController');

const { protect } = require('../middleware/authMiddleware');

// 🔥 NEW (FIXED)
const {
  uploadPdfHandler,
  parsePdfsHandler,
  generateLeaderboardHandler,
} = require('../controllers/marksUploadController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

// existing routes
router.post('/',          addMarks);
router.get('/',           getAllMarks);
router.get('/cgpa',       getCGPA);
router.delete('/:id',     deleteMarks);

// semester routes
router.get('/grade-options',     getGradeOptions);
router.get('/semesters',         getSemesters);
router.get('/cgpa-semester',     getCGPAbySemester);
router.post('/semester',         addSemester);
router.post('/semester/manual',  addManualSGPA);
router.put('/semester/:id',      updateSemester);
router.delete('/semester/:id',   deleteSemester);

// PDF leaderboard
router.post('/upload-pdf', upload.single('file'), uploadPdfHandler);
router.post('/parse-pdfs', upload.array('files', 20), parsePdfsHandler);
router.post('/generate-leaderboard', generateLeaderboardHandler);

module.exports = router;