const express      = require('express');
const router       = express.Router();
const {protect}      = require('../middleware/authMiddleware');   // your existing JWT middleware
const Notification = require('../models/Notification');

// ── GET /api/notifications ────────────────────────────────────────────────────
// Returns the latest 20 notifications for the logged-in user.
router.get('/', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })   // newest first
      .limit(20)
      .lean();

    // Also return unread count so the bell badge can update without extra call
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

// ── PATCH /api/notifications/:id/read ────────────────────────────────────────
// Mark a single notification as read.
router.patch('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },   // ownership check
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

// ── PATCH /api/notifications/read-all ────────────────────────────────────────
// Mark ALL notifications as read in one click.
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

module.exports = router;