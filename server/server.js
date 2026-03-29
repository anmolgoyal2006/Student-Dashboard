const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// CORS
app.use(cors({
  origin: [
    'https://student-dashboard-ashy-rho.vercel.app',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Timeout
app.use((req, res, next) => {
  res.setTimeout(45000, () => {
    res.status(503).json({ message: 'Request timeout — server busy' });
  });
  next();
});

// Health
app.get('/api/ping', (_req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/timetable', require('./routes/timetableRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/marks', require('./routes/marksRoutes'));
app.use('/api/career', require('./routes/careerRoutes'));
app.use('/api/recommendations', require('./routes/recommendationRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message });
});

// DB + Server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });