const express    = require('express');
const router     = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Attendance = require('../models/Attendance');
const Marks      = require('../models/Marks');

router.get('/', protect, async (req, res) => {
  const userId = req.user.id;
  const notifications = [];

  try {
    // Low attendance alerts
    const records = await Attendance.find({ userId }).populate('subjectId', 'name');
    const map = {};
    for (const r of records) {
      if (!r.subjectId) continue;
      const key = r.subjectId._id.toString();
      if (!map[key]) map[key] = { name: r.subjectId.name, total: 0, present: 0 };
      if (r.status !== 'cancelled') {
        map[key].total++;
        if (r.status === 'present') map[key].present++;
      }
    }
    for (const s of Object.values(map)) {
      if (!s.total) continue;
      const pct = (s.present / s.total) * 100;
      if (pct < 75) {
        notifications.push({
          type:    'danger',
          title:   'Low Attendance Alert',
          message: `${s.name}: ${pct.toFixed(1)}% — attend more classes!`,
          time:    new Date(),
        });
      }
    }

    // Upcoming exams (marks with examDate in next 7 days)
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);
    const upcoming = await Marks.find({
      userId,
      examDate: { $gte: new Date(), $lte: soon },
    }).populate('subjectId', 'name');
    for (const m of upcoming) {
      notifications.push({
        type:    'info',
        title:   'Upcoming Exam',
        message: `${m.subjectId?.name} ${m.examType} on ${new Date(m.examDate).toDateString()}`,
        time:    m.examDate,
      });
    }

    // Daily summary
    notifications.push({
      type:    'success',
      title:   'Daily Summary',
      message: `You have ${records.length} attendance records. Keep up the good work!`,
      time:    new Date(),
    });

    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
