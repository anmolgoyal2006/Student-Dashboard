const express      = require('express');
const router       = express.Router();
const {protect}      = require('../middleware/authMiddleware');
const Notification = require('../models/Notification');

// ── GET /api/notifications ────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    // Auto-delete notifications older than 7 days
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await Notification.deleteMany({ userId: req.user._id, createdAt: { $lt: cutoff } });

    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(6)   // only last 6 in the Dashboard panel
      .lean();

    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      read:   false,
    });

    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('[Notifications] GET error:', err.message);
    res.status(500).json({ message: 'Server error fetching notifications' });
  }
});

// ── POST /api/notifications/test ─────────────────────────────────────────────
// Creates a test notification in DB so you can verify the pipeline end-to-end
router.post('/test', protect, async (req, res) => {
  try {
    const n = await Notification.create({
      userId: req.user._id,
      title:  '🔔 Test Notification',
      body:   'Your notification system is working correctly!',
      type:   'INFO',
    });
    res.json({ success: true, notification: n });
  } catch (err) {
    console.error('[Notifications] POST test error:', err.message);
    res.status(500).json({ message: 'Failed to create test notification' });
  }
});

// ── POST /api/notifications/test-push ────────────────────────────────────────
// Sends a real FCM push to the logged-in user's registered tokens.
// Use this to verify the full Firebase Admin → device pipeline.
router.post('/test-push', protect, async (req, res) => {
  try {
    const { sendNotification } = require('../services/notificationEngine');

    // Bypass 24h dedup by using a unique title each time
    const title = `🔔 Push Test ${new Date().toLocaleTimeString('en-IN')}`;
    const result = await sendNotification(
      req.user._id,
      title,
      'If you see this as a browser/phone notification, FCM is working.',
      { type: 'INFO' }
    );

    res.json({
      success: result.success,
      reason: result.reason || null,
      results: result.results || [],
      message: result.success
        ? `Push sent to ${result.results.length} token(s)`
        : `Not sent — reason: ${result.reason || result.error}`,
    });
  } catch (err) {
    console.error('[Notifications] POST test-push error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /notifications/read-all ────────────────────────────────────────────
// Must be BEFORE /:id route to avoid Express treating 'read-all' as an id param
router.patch('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('[Notifications] PATCH read-all error:', err.message);
    res.status(500).json({ message: 'Server error marking all read' });
  }
});

// ── PATCH /notifications/:id/read ────────────────────────────────────────────
router.patch('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(notification);
  } catch (err) {
    console.error('[Notifications] PATCH read error:', err.message);
    res.status(500).json({ message: 'Server error marking notification read' });
  }
});

module.exports = router;