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
} = require('../controllers/marksController');

const { protect } = require('../middleware/authMiddleware');

// 🔥 NEW (FIXED)
const { uploadPdfHandler } = require('../controllers/marksUploadController');
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
router.put('/semester/:id',      updateSemester);
router.delete('/semester/:id',   deleteSemester);

// 🔥 ONLY THIS
router.post('/upload-pdf', upload.single('file'), uploadPdfHandler);

module.exports = router;