const express = require('express');
const router  = express.Router();
const {
  markAttendance,
  getAttendanceSummary,
  getBySubject,
  getMonthlyTrends,
  markFromNotification,
  getStudentBySid
} = require('../controllers/attendanceController');

const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', markAttendance);
router.get('/summary', getAttendanceSummary);
router.get('/trends', getMonthlyTrends);

// ✅ PUT THIS BEFORE :subjectId
router.post('/mark-from-notification', markFromNotification);

// Student attendance view by SID (teacher feature)
router.get('/student/:sid', getStudentBySid);

// ❗ KEEP THIS LAST
router.get('/:subjectId', getBySubject);

module.exports = router;