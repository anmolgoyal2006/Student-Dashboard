// MUST be the very first require — initializes Sentry (and loads .env)
// before anything else in the app is imported. Requiring app.js (from
// server.js or from a test) therefore always initializes Sentry first.
const Sentry = require('./instrument');

const express     = require('express');
const cors        = require('cors');
const mongoose    = require('mongoose');
const helmet      = require('helmet');
const compression = require('compression');

const app = express();

// ─── Security headers (as early in the chain as possible) ─────────────────
app.use(helmet());

// ─── Health check (before all other middleware/routes) ─────────────────
app.get('/health', (_req, res) => res.status(200).send('OK'));

const passport = require('./config/passport');
app.use(passport.initialize());

const allowedOrigins = [
  'https://student-dashboard-ashy-rho.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
];

const corsOptions = {
  origin: (origin, cb) => {
    // allow requests with no origin (mobile apps, curl, Postman)
    // and any Vercel preview deployments
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      /\.vercel\.app$/.test(origin)
    ) return cb(null, true);
    cb(new Error(`CORS blocked for origin: ${origin}`));
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
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

module.exports = app;
