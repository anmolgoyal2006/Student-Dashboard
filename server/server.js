const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { sendTodayNotifications } = require('./services/notificationService');

const app = express();

// ─── Health check (before all other middleware/routes) ─────────────────
app.get('/health', (_req, res) => res.status(200).send('OK'));

const passport = require('./config/passport');
app.use(passport.initialize());

// ─── Jobs ─────────────────────────────────────────────────────────────────
const { startDailyNotificationJob } = require('./jobs/dailyNotificationJob'); // ← ADDED

// REPLACE WITH:
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

// ─── Body parsing ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ─── Request timeout (180s) ───────────────────────────────────────────────
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


// 🔥 ADD HERE
app.get('/api/test-notification', async (req, res) => {
  try {
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

// ─── Global error handler ─────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

// ─── MongoDB + Server start ───────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

 // Keep-alive ping every 10 minutes (prevents Render free tier sleep)
setInterval(() => {
  const http = require('http');
  http.get(`http://localhost:${process.env.PORT || 5000}/api/ping`, () => {});
}, 10 * 60 * 1000);
const startServer = () => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
};

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  w: 'majority',
})
  .then(() => {
    console.log('MongoDB connected');
    startDailyNotificationJob();
    startServer();
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    console.warn('[Dev] Starting API without MongoDB — DB-backed features may fail.');
    startServer();
  });

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected — attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err.message);
});