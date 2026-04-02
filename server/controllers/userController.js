const User   = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

const generateToken = (user) =>
  jwt.sign(
    { id: user._id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

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
      user:    { id: updated._id, name: updated.name, email: updated.email, college: updated.college, semester: updated.semester },
      token:   newToken,
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