// routes/adminRoutes.js
const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

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

module.exports = router;