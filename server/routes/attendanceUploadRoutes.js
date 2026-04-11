// routes/attendanceUploadRoutes.js
const express = require('express');
const router  = express.Router();

const upload  = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');
const {
  uploadBulkAttendance,
  getAttendanceBySid,
  getClassSummary,
  downloadTemplate,
} = require('../controllers/attendanceUploadController');

// All routes require authentication
router.use(protect);

// POST /api/attendance/upload  — teacher uploads Excel
router.post('/upload', upload.single('file'), uploadBulkAttendance);

// GET  /api/attendance/student/:sid  — fetch attendance by SID
router.get('/student/:sid', getAttendanceBySid);

// GET  /api/attendance/template  — download sample Excel
router.get('/template',      downloadTemplate);
router.get('/class-summary', getClassSummary);

module.exports = router;