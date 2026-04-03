const crypto     = require('crypto');
const User       = require('../models/User');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const generateToken = (user) =>
  jwt.sign(
    { id: user._id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

// ── Brevo SMTP transporter ────────────────────────────────
const createTransporter = () =>
  nodemailer.createTransport({
    host:   'smtp-relay.brevo.com',
    port:   587,
    secure: false,
    auth: {
      user: process.env.BREVO_USER,
      pass: process.env.BREVO_PASS,
    },
  });

// PUT /api/user/update-profile  (unchanged)
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
      req.user.id, { $set: updateFields }, { new: true, runValidators: true }
    ).select('-password');
    if (!updated) return res.status(404).json({ message: 'User not found.' });
    const newToken = generateToken(updated);
    res.json({
      message: 'Profile updated successfully.',
      user:  { id: updated._id, name: updated.name, email: updated.email, college: updated.college, semester: updated.semester },
      token: newToken,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/user/change-password  (unchanged)
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
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Old password is incorrect.' });
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: 'Password changed successfully. Please log in again.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/user/forgot-password
exports.forgotPassword = async (req, res) => {
    console.log('BREVO_USER:', process.env.BREVO_USER); // ← add this
  console.log('BREVO_PASS length:', process.env.BREVO_PASS?.length); // ← add this
  const { email } = req.body;

  const GENERIC = { message: 'If that email is registered, a reset link has been sent.' };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return res.status(400).json({ message: 'Please provide a valid email address.' });

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.json(GENERIC);

    const rawToken    = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken   = hashedToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    const resetURL    = `${process.env.FRONTEND_URL}/reset-password/${rawToken}`;
    const transporter = createTransporter();

    await transporter.sendMail({
      from:    '"StudentAI" <anmolgoyal1974@gmail.com>',
      to:      user.email,
      subject: 'StudentAI — Reset Your Password',
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;
                    background:#0f0f23;color:#f1f5f9;border-radius:12px;">
          <h2 style="color:#818cf8;margin-bottom:8px;">🎓 StudentAI</h2>
          <h3 style="margin-bottom:16px;">Password Reset Request</h3>
          <p style="color:#94a3b8;line-height:1.6;">
            Hi <strong style="color:#f1f5f9;">${user.name}</strong>,<br/><br/>
            Click the button below to reset your password.
            This link expires in <strong>15 minutes</strong>.
          </p>
          <a href="${resetURL}"
             style="display:inline-block;margin:24px 0;padding:14px 28px;
                    background:linear-gradient(135deg,#4f46e5,#6366f1);
                    color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
            Reset My Password
          </a>
          <p style="color:#475569;font-size:13px;line-height:1.6;">
            Or copy this link:<br/>
            <a href="${resetURL}" style="color:#818cf8;word-break:break-all;">${resetURL}</a>
          </p>
          <hr style="border:1px solid #1d1d4a;margin:24px 0;"/>
          <p style="color:#475569;font-size:12px;">
            If you didn't request this, ignore this email.
          </p>
        </div>
      `,
    });

    res.json(GENERIC);
  } catch (err) {
    console.error('[forgotPassword]', err.message);
    await User.findOneAndUpdate(
      { email: email.trim().toLowerCase() },
      { $unset: { resetPasswordToken: '', resetPasswordExpires: '' } }
    ).catch(() => {});
    res.status(500).json({ message: 'Failed to send reset email. Please try again.' });
  }
};

// POST /api/user/reset-password/:token  (unchanged)
exports.resetPassword = async (req, res) => {
  const { token }       = req.params;
  const { newPassword } = req.body;
  if (!token)
    return res.status(400).json({ message: 'Reset token is missing.' });
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken:   hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user)
      return res.status(400).json({ message: 'Reset link is invalid or has expired.' });
    user.password             = await bcrypt.hash(newPassword, 12);
    user.resetPasswordToken   = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};