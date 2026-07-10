const express = require('express');
const router  = express.Router();
const { body, param } = require('express-validator');
const {
  markAttendance,
  getAttendanceSummary,
  getBySubject,
  getMonthlyTrends,
  markFromNotification,
  getStudentBySid
} = require('../controllers/attendanceController');

const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');

router.use(protect);

router.post('/', validate([
  body('subjectId').notEmpty().isMongoId().withMessage('subjectId is required.'),
  body('date').notEmpty().isISO8601().withMessage('A valid date is required.'),
  body('status').isIn(['present', 'absent', 'cancelled']).withMessage('status must be one of: present, absent, cancelled'),
  body('slot').optional().isString(),
  body('time').optional().isString(),
]), markAttendance);

router.get('/summary', getAttendanceSummary);
router.get('/trends', getMonthlyTrends);

// ✅ PUT THIS BEFORE :subjectId
router.post('/mark-from-notification', validate([
  // subjectId can be either a Mongo ID or a subject name string (controller
  // does an $or lookup) — do not constrain to isMongoId() here.
  body('subjectId').notEmpty().withMessage('subjectId is required'),
  body('status').isIn(['attended', 'not_attended', 'not_held']).withMessage('Invalid status'),
  body('date').optional().isISO8601(),
  body('slot').optional().isString(),
  body('time').optional().isString(),
]), markFromNotification);

// Student attendance view by SID (teacher feature)
router.get('/student/:sid', getStudentBySid);

// ❗ KEEP THIS LAST
router.get('/:subjectId', validate([param('subjectId').isMongoId()]), getBySubject);

module.exports = router;