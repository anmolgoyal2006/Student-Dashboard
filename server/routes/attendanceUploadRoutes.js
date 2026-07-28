// routes/attendanceUploadRoutes.js
const express = require('express');
const router  = express.Router();
const { body } = require('express-validator');

const upload  = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const {
  uploadBulkAttendance,
  uploadBulkAttendanceFromUrl,
  getAttendanceBySid,
  getClassSummary,
  downloadTemplate,
} = require('../controllers/attendanceUploadController');

// All routes require authentication
router.use(protect);

// POST /api/attendance/upload  — teacher uploads Excel
router.post('/upload', upload.single('file'), uploadBulkAttendance);

// POST /api/attendance/upload-url — teacher imports Excel from URL link
// NOTE: isURL() here is only a shallow format pre-check. The real security
// control is the SSRF guard (assertPublicHttpUrl/DNS+private-IP checks)
// inside attendanceUploadController.js — that must never be removed.
router.post('/upload-url', validate([
  body('url').notEmpty().isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('URL link is required.'),
]), uploadBulkAttendanceFromUrl);

// GET  /api/attendance/template  — download sample Excel
router.get('/template',      downloadTemplate);
router.get('/class-summary', getClassSummary);

module.exports = router;