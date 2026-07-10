const express    = require('express');
const router     = express.Router();
const { body }   = require('express-validator');
const passport   = require('../config/passport');          // ← ADD
const jwt        = require('jsonwebtoken');                // ← ADD
const { signup, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimitMiddleware');
const { validate } = require('../middleware/validate');

router.post('/signup', authLimiter, validate([
  body('name').trim().notEmpty().withMessage('Name is required.'),
  body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  body('college').optional().isString(),
  body('branch').optional().isString(),
  body('sid').optional().isString(),
  body('semester').optional().isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1 and 8.'),
]), signup);

router.post('/login', authLimiter, validate([
  body('email').isEmail().withMessage('A valid email is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
]), login);

router.get ('/me',      protect, getMe);

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