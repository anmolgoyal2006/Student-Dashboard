const mongoose = require('mongoose');
const User   = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

const generateToken = (user) =>
  jwt.sign(
    { id: user._id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

// POST /api/auth/signup
exports.signup = async (req, res) => {
  const { name, email, password, college, semester, branch } = req.body;
  try {
    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required.' });

    if (await User.findOne({ email }))
      return res.status(400).json({ message: 'Email already registered.' });

    const hashed = await bcrypt.hash(password, 12);
    const user   = await User.create({ name, email, password: hashed, college, semester, branch });

    res.status(201).json({
      token: generateToken(user),
      user:  { id: user._id, name: user.name, email: user.email, college: user.college, semester: user.semester },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: 'Invalid email or password.' });

    res.json({
      token: generateToken(user),
      user:  { id: user._id, name: user.name, email: user.email, college: user.college, semester: user.semester },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).select('-password');
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
