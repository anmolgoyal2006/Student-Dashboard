const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Strict limiter for brute-forceable, unauthenticated auth endpoints
// (login, signup, forgot-password). Keyed by IP since there's no
// authenticated user yet at these endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,                // 10 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
});

// Per-user limiter for AI-calling endpoints (paid Gemini API calls).
// These routes always run `protect` first, so req.user is guaranteed —
// key on the authenticated user id instead of IP for fairness.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30,                // 30 AI requests per user per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.user?.id ? String(req.user.id)
    : req.user?._id ? String(req.user._id)
    : ipKeyGenerator(req.ip),
  message: { message: 'Too many AI requests. Please slow down and try again shortly.' },
});

module.exports = { authLimiter, aiLimiter };
