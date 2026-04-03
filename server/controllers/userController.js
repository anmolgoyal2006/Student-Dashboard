const crypto     = require('crypto'); // ✅ NEW
const User       = require('../models/User');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer'); // ✅ NEW

const generateToken = (user) =>
  jwt.sign(
    { id: user._id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

// ✅ NEW: Email transporter
const createTransporter = () =>
  nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });


// ================= EXISTING =================

// PUT /api/user/update-profile
exports.updateProfile = async (req, res) => {
  const { name, email } = req.body;

  if (!name?.trim() && !email?.trim())
    return res.status(400).json({ message: 'Provide at least a name or email to update.' });

  try {
    if (email && email.toLowerCase() !== req.user.email.toLowerCase()) {
      const exists = await User.findOne({ email: email.toLowerCase() });
      if (exists)
        return res.status(400).json({ message: 'This email is already registered to another account.' });
    }

    const updateFields = {};
    if (name?.trim())  updateFields.name  = name.trim();
    if (email?.trim()) updateFields.email = email.trim().toLowerCase();

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updated)
      return res.status(404).json({ message: 'User not found.' });

    const newToken = generateToken(updated);

    res.json({
      message: 'Profile updated successfully.',
      user: {
        id: updated._id,
        name: updated.name,
        email: updated.email,
        college: updated.college,
        semester: updated.semester
      },
      token: newToken,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// PUT /api/user/change-password
exports.changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword)
    return res.status(400).json({ message: 'Old password and new password are required.' });

  if (newPassword.length < 6)
    return res.status(400).json({ message: 'New password must be at least 6 characters.' });

  if (oldPassword === newPassword)
    return res.status(400).json({ message: 'New password must be different from the old password.' });

  try {
    const user = await User.findById(req.user.id);
    if (!user)
      return res.status(404).json({ message: 'User not found.' });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch)
      return res.status(401).json({ message: 'Old password is incorrect.' });

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.json({ message: 'Password changed successfully. Please log in again.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// ================= NEW FEATURES =================

// POST /api/user/forgot-password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  const GENERIC = {
    message: 'If that email is registered, a reset link has been sent.'
  };

  if (!email)
    return res.status(400).json({ message: 'Email is required.' });

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    // 🔐 Do NOT reveal if email exists
    if (!user) return res.json(GENERIC);

    // Generate token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 min
    await user.save();

    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${rawToken}`;

    const transporter = createTransporter();

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: 'Reset Your Password',
      html: `
        <h2>Password Reset</h2>
        <p>Click below to reset your password:</p>
        <a href="${resetURL}">Reset Password</a>
        <p>This link expires in 15 minutes.</p>
      `
    });

    res.json(GENERIC);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error sending email' });
  }
};


// POST /api/user/reset-password/:token
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user)
      return res.status(400).json({ message: 'Token invalid or expired.' });

    user.password = await bcrypt.hash(newPassword, 12);

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ message: 'Password reset successful.' });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};