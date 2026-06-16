// routes/adminRoutes.js
const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const Event   = require('../models/Event');
const EventFetchLog = require('../models/EventFetchLog');
const { protect } = require('../middleware/authMiddleware');
const { runCollectors } = require('../jobs/collectorScheduler');
const { sendDueReminders } = require('../services/reminderService');
const { detectDuplicates } = require('../services/eventService');

// Middleware: only teachers can access admin routes
const teacherOnly = (req, res, next) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied.' });
  }
  next();
};

// GET /api/admin/users — list all users with their roles
router.get('/users', protect, teacherOnly, async (req, res) => {
  try {
    const users = await User.find()
      .select('name email sid role college branch semester createdAt')
      .sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admin/users/:id/role — change a user's role
router.patch('/users/:id/role', protect, teacherOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['student', 'teacher'].includes(role)) {
      return res.status(400).json({ message: 'Role must be student or teacher.' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { role } },
      { new: true }
    ).select('name email sid role');

    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({ message: `Role updated to ${role}`, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/dashboard — get dashboard stats
router.get('/dashboard', protect, teacherOnly, async (req, res) => {
  try {
    // Total events
    const totalEvents = await Event.countDocuments();

    // Events by source
    const eventsBySource = await Event.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);

    // Last collector runs
    const lastRuns = await EventFetchLog.find()
      .sort({ startedAt: -1 })
      .limit(10);

    // Last run time
    const lastRun = await EventFetchLog.findOne().sort({ startedAt: -1 });

    // Failed collectors (last run per collector)
    const lastPerCollector = await EventFetchLog.aggregate([
      { $sort: { startedAt: -1 } },
      { 
        $group: { 
          _id: '$collectorName', 
          lastRun: { $first: '$$ROOT' } 
        } 
      }
    ]);
    
    const failedCollectors = lastPerCollector.filter(log => log.lastRun.status === 'failed');

    res.json({
      stats: {
        totalEvents,
        eventsBySource: eventsBySource.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        lastRunTime: lastRun?.startedAt || null,
        lastRuns,
        failedCollectors
      }
    });
  } catch (err) {
    console.error('[Admin] Error getting dashboard stats:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admin/collectors/run — manually trigger collectors
router.post('/collectors/run', protect, teacherOnly, async (req, res) => {
  try {
    res.json({ message: 'Collector run started!' });
    // Run in background
    runCollectors();
  } catch (err) {
    console.error('[Admin] Error triggering collectors:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admin/reminders/run — manually trigger reminder check
router.post('/reminders/run', protect, teacherOnly, async (req, res) => {
  try {
    res.json({ message: 'Reminder check started!' });
    // Run in background
    sendDueReminders();
  } catch (err) {
    console.error('[Admin] Error triggering reminders:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admin/duplicates/run — manually run duplicate detection
router.post('/duplicates/run', protect, teacherOnly, async (req, res) => {
  try {
    const results = await detectDuplicates();
    res.json(results);
  } catch (err) {
    console.error('[Admin] Error running duplicate detection:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;