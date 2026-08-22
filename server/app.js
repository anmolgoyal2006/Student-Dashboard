// MUST be the very first require — initializes Sentry (and loads .env)
// before anything else in the app is imported. Requiring app.js (from
// server.js or from a test) therefore always initializes Sentry first.
const Sentry = require('./instrument');

const express     = require('express');
const cors        = require('cors');
const mongoose    = require('mongoose');
const helmet      = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const multer = require('multer');

const app = express();

// ─── Security headers (as early in the chain as possible) ─────────────────
app.use(helmet());

// ─── Health check (before all other middleware/routes) ─────────────────
app.get('/health', (_req, res) => res.status(200).send('OK'));

// Signed with JWT_SECRET so the OAuth `state` cookie cannot be forged.
app.use(cookieParser(process.env.JWT_SECRET));

const passport = require('./config/passport');
app.use(passport.initialize());

const allowedOrigins = [
  // ── Production Vercel deployments ──────────────────────────────────────────
  // Primary production alias (set in Vercel project settings → Domains).
  // If you ever rename the project or add a custom domain, add the new URL here.
  'https://student-dashboard-ashy-rho.vercel.app',
  // Vercel also assigns a bare project-name alias that does NOT match the
  // preview-deploy pattern below (no random suffix), so it needs its own entry.
  'https://student-dashboard.vercel.app',
  // ── Local development ───────────────────────────────────────────────────────
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
];

// Vercel preview deploys get auto-generated subdomains like
// student-dashboard-abc123-username.vercel.app — handle them with a pattern
// rather than trying to enumerate every possible URL.
// Intentionally scoped to THIS project's prefix so a random attacker can't
// spin up their own Vercel site and call our API cross-origin.
const VERCEL_PREVIEW = /^https:\/\/student-dashboard-[a-z0-9-]+\.vercel\.app$/;

function isOriginAllowed(origin) {
  if (!origin) return true; // server-to-server, mobile apps, curl, Postman
  return allowedOrigins.includes(origin) || VERCEL_PREVIEW.test(origin);
}

const corsOptions = {
  origin: (origin, cb) => {
    if (isOriginAllowed(origin)) return cb(null, true);
    // Return false (not an Error) so Express does NOT throw — this means the
    // response still goes through normally, just without the CORS headers.
    // Throwing an Error here caused the global error handler to respond before
    // cors() could set Access-Control-Allow-Origin, so the browser saw the
    // "No Access-Control-Allow-Origin header" error even on valid routes
    // (e.g. GET /api/marks/cgpa from a Vercel preview URL not yet in the list).
    cb(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // ← same config for preflight

// ─── Response compression (gzip/deflate) ──────────────────────────────────
// Render runs this as a bare Node container with no proxy in front, so nothing
// gzips responses unless we do it here. Runs before the routes so all JSON
// payloads are compressed; the built-in ~1 KB threshold skips tiny responses
// (e.g. /api/ping), and it honours the client's Accept-Encoding automatically.
app.use(compression());

// ─── Body parsing ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ─── Request timeout (600s) ───────────────────────────────────────────────
// Deliberately long: marks/attendance uploads run PDF parsing + Python OCR
// child processes that can legitimately take minutes (the client axios timeout
// is 600s to match). Per-dependency timeouts + circuit breakers (see
// utils/circuitBreaker.js) guard the external calls that could otherwise hang.
app.use((req, res, next) => {
  res.setTimeout(600000, () => {
    res.status(503).json({ message: 'Request timeout — server busy' });
  });
  next();
});

// ─── Health endpoints ─────────────────────────────────────────────────────
app.get('/api/ping',   (_req, res) => res.json({ status: 'ok', ts: Date.now() }));
app.get('/api/health', (_req, res) => res.json({
  status: 'ok',
  db: mongoose.connection.readyState,
  uptime: process.uptime(),
}));

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/api/tasks',           require('./routes/taskRoutes'));
app.use('/api/auth',            require('./routes/authRoutes'));
app.use('/auth',                require('./routes/authRoutes'));
app.use('/api/subjects',        require('./routes/timetableRoutes'));
app.use('/api/timetable',       require('./routes/timetableRoutes'));
app.use('/api/attendance', require('./routes/attendanceUploadRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/marks',           require('./routes/marksRoutes'));
app.use('/api/career',          require('./routes/careerRoutes'));
app.use('/api/recommendations', require('./routes/recommendationRoutes'));
app.use('/api/notifications',   require('./routes/notificationRoutes'));
app.use('/api/user',            require('./routes/userRoutes'));
app.use('/api/ai',              require('./routes/aiRoutes'));
app.use('/api/decision',        require('./routes/decisionRoutes'));
app.use('/api/predict',         require('./routes/predictionRoutes'));
app.use('/api/ai-command',      require('./routes/aiCommandRoutes'));
app.use('/api/admin',           require('./routes/adminRoutes'));
app.use('/api/classroom',       require('./routes/classroomRoutes'));
app.use('/api/analytics',       require('./routes/analyticsRoutes'));
app.use('/api',                 require('./routes/riskRoutes'));
app.use('/api/events',          require('./routes/eventRoutes'));
app.use('/api/opportunities',   require('./routes/opportunitiesRoutes'));

// ─── Sentry verification route (non-production only — this deliberately
// throws, so it must not be a permanent public attack surface in prod) ─────
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug-sentry', (_req, res) => {
    Sentry.logger.info('User triggered test error', { action: 'test_error_endpoint' });
    throw new Error('My first Sentry error!');
  });
}

app.get('/api/test-notification', async (req, res) => {
  try {
    const { sendTodayNotifications } = require('./services/notificationService');
    await sendTodayNotifications();
    res.json({ message: 'Test notification triggered' });
  } catch (err) {
    console.error('[TEST NOTIFICATION ERROR]', err.message);
    res.status(500).json({ message: 'Failed to send test notification' });
  }
});

// ─── 404 handler ──────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ─── Sentry error capture (reports to Sentry, then falls through to our
// own error-formatting handler below — this augments the existing
// console.error logging, it doesn't replace it) ────────────────────────────
Sentry.setupExpressErrorHandler(app);

// ─── Global error handler ─────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Error]', err.message);

  // Multer rejects oversized/too-many/disallowed files. These are client
  // mistakes, not server faults, so they must not surface as 500s.
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'  ? 'File is too large.' :
      err.code === 'LIMIT_FILE_COUNT' ? 'Too many files uploaded.' :
      `Upload rejected: ${err.message}`;
    return res.status(413).json({ message });
  }
  if (/Only .* (are allowed|supported)/i.test(err.message || '')) {
    return res.status(400).json({ message: err.message });
  }

  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

module.exports = app;
