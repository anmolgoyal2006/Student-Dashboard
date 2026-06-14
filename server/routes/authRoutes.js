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
  (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, user, info) => {
      if (err) {
        console.error('[Google OAuth] Strategy error:', err.message);
        return res.redirect('https://student-dashboard-ashy-rho.vercel.app/login?error=google_failed');
      }
      if (!user) {
        console.error('[Google OAuth] No user returned:', info);
        return res.redirect('https://student-dashboard-ashy-rho.vercel.app/login?error=google_failed');
      }

      if (!process.env.JWT_SECRET) {
        console.error('[Google OAuth] JWT_SECRET is not set!');
        return res.redirect('https://student-dashboard-ashy-rho.vercel.app/login?error=server_error');
      }

      try {
        const token = jwt.sign(
          { id: user._id, email: user.email, name: user.name, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );
        return res.redirect(
          `https://student-dashboard-ashy-rho.vercel.app/login-success?token=${token}`
        );
      } catch (jwtErr) {
        console.error('[Google OAuth] JWT sign error:', jwtErr.message);
        return res.redirect('https://student-dashboard-ashy-rho.vercel.app/login?error=server_error');
      }
    })(req, res, next);
  }
);

module.exports = router;