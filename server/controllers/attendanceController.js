const Attendance = require('../models/Attendance');
const Subject    = require('../models/Subject');

// POST /api/attendance
exports.markAttendance = async (req, res) => {
  const { subjectId, date, status } = req.body;
  const userId = req.user.id;
  try {
    const record = await Attendance.findOneAndUpdate(
      { userId, subjectId, date: new Date(date) },
      { status },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ message: 'Attendance marked', attendance: record });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/attendance/summary
exports.getAttendanceSummary = async (req, res) => {
  const userId = req.user.id;
  try {
    const records = await Attendance.find({ userId }).populate('subjectId', 'name code credits');

    const map = {};
    for (const r of records) {
      if (!r.subjectId) continue;
      const key = r.subjectId._id.toString();
      if (!map[key]) {
        map[key] = { subject: r.subjectId.name, code: r.subjectId.code, total: 0, present: 0, absent: 0 };
      }
      if (r.status !== 'cancelled') {
        map[key].total++;
        if (r.status === 'present') map[key].present++;
        else map[key].absent++;
      }
    }

    const summary = Object.values(map).map(s => ({
      ...s,
      percentage: s.total ? +((s.present / s.total) * 100).toFixed(1) : 0,
      isLow:      s.total ? (s.present / s.total) * 100 < 75 : false,
    }));

    res.json({ summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/attendance/:subjectId
exports.getBySubject = async (req, res) => {
  try {
    const records = await Attendance.find({
      userId: req.user.id,
      subjectId: req.params.subjectId,
    }).sort({ date: -1 });
    res.json({ records });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/attendance/trends
exports.getMonthlyTrends = async (req, res) => {
  const userId = req.user.id;
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const records = await Attendance.find({
      userId,
      date: { $gte: sixMonthsAgo },
    }).populate('subjectId', 'name');

    // Group by month
    const trends = {};
    for (const r of records) {
      const month = new Date(r.date).toLocaleString('default', { month: 'short', year: '2-digit' });
      if (!trends[month]) trends[month] = { month, present: 0, total: 0 };
      if (r.status !== 'cancelled') {
        trends[month].total++;
        if (r.status === 'present') trends[month].present++;
      }
    }

    const result = Object.values(trends).map(t => ({
      ...t,
      percentage: t.total ? +((t.present / t.total) * 100).toFixed(1) : 0,
    }));

    res.json({ trends: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
