const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'https://student-dashboard-ashy-rho.vercel.app',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, cb) => {
    // allow Postman/curl (no origin header) + listed origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}));

// Handle ALL preflight requests explicitly  ← Fix 1
app.options('*', cors());

// ─── Body parsing ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request timeout (45s) ────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setTimeout(45000, () => {
    res.status(503).json({ message: 'Request timeout — server busy' });
  });
  next();
});

// ─── Health endpoints ─────────────────────────────────────────────────────
app.get('/api/ping',   (_req, res) => res.json({ status: 'ok', ts: Date.now() }));
app.get('/api/health', (_req, res) => res.json({               // ← Fix 4
  status: 'ok',
  db: mongoose.connection.readyState, // 0=disconnected 1=connected 2=connecting
  uptime: process.uptime(),
}));

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',            require('./routes/authRoutes'));
app.use('/api/timetable',       require('./routes/timetableRoutes'));
app.use('/api/subjects',        require('./routes/timetableRoutes')); // ← Fix 2 alias
app.use('/api/attendance',      require('./routes/attendanceRoutes'));
app.use('/api/marks',           require('./routes/marksRoutes'));
app.use('/api/career',          require('./routes/careerRoutes'));
app.use('/api/recommendations', require('./routes/recommendationRoutes'));
app.use('/api/notifications',   require('./routes/notificationRoutes'));

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

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000,  // ← Fix 3: fail fast if Atlas unreachable
  socketTimeoutMS: 45000,           // ← Fix 5: match request timeout
})
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });