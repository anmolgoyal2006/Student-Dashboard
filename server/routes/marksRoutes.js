const express = require('express');
const router  = express.Router();
const {
  addMarks,
  getAllMarks,
  getCGPA,
  deleteMarks,
  // ── new SGPA/CGPA-by-semester ──
  getGradeOptions,
  getSemesters,
  getCGPAbySemester,
  addSemester,
  updateSemester,
  deleteSemester,
} = require('../controllers/marksController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// ── existing routes (unchanged) ──
router.post('/',          addMarks);
router.get('/',           getAllMarks);
router.get('/cgpa',       getCGPA);
router.delete('/:id',     deleteMarks);

// ── new semester/SGPA routes ──
router.get('/grade-options',     getGradeOptions);
router.get('/semesters',         getSemesters);
router.get('/cgpa-semester',     getCGPAbySemester);
router.post('/semester',         addSemester);
router.put('/semester/:id',      updateSemester);
router.delete('/semester/:id',   deleteSemester);

module.exports = router;