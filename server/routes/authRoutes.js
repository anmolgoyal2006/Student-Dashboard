const express    = require('express');
const router     = express.Router();
const crypto     = require('crypto');
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
const CLIENT_URL = 'https://student-dashboard-ashy-rho.vercel.app';
const STATE_COOKIE = 'g_oauth_state';

// The `state` parameter is what ties the callback back to the browser that
// actually started the login. Without it, an attacker can feed a victim a
// callback URL carrying the attacker's Google auth code and silently sign the
// victim's browser into the attacker's account (login CSRF) — everything the
// victim then uploads lands in the attacker's dashboard.
//
// Passport's built-in `state: true` needs express-session; we stay stateless
// by keeping the nonce in a signed, httpOnly cookie instead. SameSite=Lax
// still sends it on the top-level GET redirect back from Google.
const stateCookieOptions = {
  httpOnly: true,
  signed: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 10 * 60 * 1000, // the round-trip through Google is short-lived
  path: '/',
};

router.get('/google', (req, res, next) => {
  const state = crypto.randomBytes(32).toString('hex');
  res.cookie(STATE_COOKIE, state, stateCookieOptions);
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state,
  })(req, res, next);
});

router.get('/google/callback',
  (req, res, next) => {
    const expected = req.signedCookies?.[STATE_COOKIE];
    const received = req.query.state;

    // Single-use: clear it before doing anything else so a replayed callback
    // can't reuse the same nonce.
    res.clearCookie(STATE_COOKIE, { ...stateCookieOptions, maxAge: undefined });

    const valid =
      typeof expected === 'string' &&
      typeof received === 'string' &&
      expected.length === received.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));

    if (!valid) {
      console.error('[Google OAuth] state mismatch — possible login CSRF');
      return res.redirect(`${CLIENT_URL}/login?error=invalid_state`);
    }

    passport.authenticate('google', { session: false }, (err, user, info) => {
      if (err) {
        console.error('[Google OAuth] Strategy error:', err.message);
        return res.redirect(`${CLIENT_URL}/login?error=google_failed`);
      }
      if (!user) {
        console.error('[Google OAuth] No user returned:', info);
        return res.redirect(`${CLIENT_URL}/login?error=google_failed`);
      }

      if (!process.env.JWT_SECRET) {
        console.error('[Google OAuth] JWT_SECRET is not set!');
        return res.redirect(`${CLIENT_URL}/login?error=server_error`);
      }

      try {
        const token = jwt.sign(
          { id: user._id, email: user.email, name: user.name, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );
        return res.redirect(`${CLIENT_URL}/login-success?token=${token}`);
      } catch (jwtErr) {
        console.error('[Google OAuth] JWT sign error:', jwtErr.message);
        return res.redirect(`${CLIENT_URL}/login?error=server_error`);
      }
    })(req, res, next);
  }
);

module.exports = router;