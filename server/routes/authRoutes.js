const express    = require('express');
const router     = express.Router();
const passport   = require('../config/passport');          // ← ADD
const jwt        = require('jsonwebtoken');                // ← ADD
const { signup, login, getMe, updateProfile,
        changePassword, forgotPassword,
        resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/signup',  signup);
router.post('/login',   login);
router.get ('/me',      protect, getMe);
router.put ('/profile', protect, updateProfile);
router.put ('/change-password',     protect, changePassword);
router.post('/forgot-password',     forgotPassword);
router.post('/reset-password/:token', resetPassword);

// ── Google OAuth ──────────────────────────────────────────────────────────
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

router.get('/google/callback',
  passport.authenticate('google', {
    session:  false,
    failureRedirect: 'https://student-dashboard-ashy-rho.vercel.app/login?error=google_failed',
  }),
  (req, res) => {
    // Generate JWT same way as normal login
 const token = jwt.sign(
      { id: req.user._id, email: req.user.email, name: req.user.name, role: req.user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Redirect to frontend with token
    res.redirect(
      `https://student-dashboard-ashy-rho.vercel.app/login-success?token=${token}`
    );
  }
);

module.exports = router;