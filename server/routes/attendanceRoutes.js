const express = require('express');
const router  = express.Router();
const { markAttendance, getAttendanceSummary, getBySubject, getMonthlyTrends } = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/',                  markAttendance);
router.get('/summary',            getAttendanceSummary);
router.get('/trends',             getMonthlyTrends);
router.get('/:subjectId',         getBySubject);

module.exports = router;
