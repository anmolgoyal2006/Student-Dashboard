// Runtime entry point: builds nothing itself — it imports the configured
// Express app (which also initializes Sentry via its own first require),
// connects to MongoDB, starts background jobs, and begins listening.
// The app is defined in app.js so it can be imported by tests without
// connecting to the real database or starting cron jobs.
const app      = require('./app');
const mongoose = require('mongoose');
const cron     = require('node-cron');
const Sentry   = require('./instrument');

const { startDailyNotificationJob } = require('./jobs/dailyNotificationJob');
const { startClassroomSyncJob } = require('./jobs/classroomSyncJob');
const { startNotificationJobs } = require('./jobs/notificationSyncJob');
const { startDigestJobs } = require('./jobs/digestJobs');
const { startCollectorScheduler } = require('./jobs/collectorScheduler');

const PORT = process.env.PORT || 5000;

// Keep-alive ping every 10 minutes (prevents Render free tier sleep)
setInterval(() => {
  const http = require('http');
  http.get(`http://localhost:${process.env.PORT || 5000}/api/ping`, () => {});
}, 10 * 60 * 1000);

let server;

const startServer = () => {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
};

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  w: 'majority',
})
  .then(async () => {
    console.log('MongoDB connected');

    // ── Drop stale indexes before starting server ──────────────────────
    try {
      const Attendance = require('./models/Attendance');
      await Attendance.collection.dropIndex('userId_1_subjectId_1_date_1');
      console.log('[Index] Dropped stale attendance index');
    } catch (_) {}

    // Drop the bad non-sparse unique sid_1 index — sid no longer has unique:true in schema
    try {
      const User = require('./models/User');
      await User.collection.dropIndex('sid_1');
      console.log('[Index] Dropped sid_1 index — sid uniqueness removed from schema');
    } catch (_) {}
    // ── Ensure notification dedup index exists ────────────────────────
    // syncIndexes() is intentionally not called globally, but this one index
    // is critical for atomic dedup — ensure it exists explicitly.
    try {
      const Notification = require('./models/Notification');
      try {
        await Notification.collection.dropIndex('userId_1_dedupKey_1');
      } catch (_) {}
      await Notification.collection.createIndex(
        { userId: 1, dedupKey: 1 },
        {
          unique: true,
          partialFilterExpression: { dedupKey: { $type: 'string' } },
          name: 'userId_1_dedupKey_1'
        }
      );
      console.log('[Index] Notification dedup index ensured');
    } catch (err) {
      // Code 85 = index already exists with same spec, 86 = different options — both fine
      if (err.code !== 85 && err.code !== 86) {
        console.warn('[Index] Could not ensure notification dedup index:', err.message);
      }
    }

    // NOTE: do NOT call syncIndexes() — it would recreate indexes from schema
    startDailyNotificationJob();
    startClassroomSyncJob();
    startNotificationJobs();
    startDigestJobs();
    startCollectorScheduler();
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

// ── Last-resort process handlers ───────────────────────────────────────
// These are a safety net, not a substitute for local try/catch: every cron
// callback is already wrapped in safeJob(). Without them a single unhandled
// rejection anywhere would terminate the process and take every user's
// requests down with it.
const shutdown = (reason, err) => {
  console.error(`[FATAL] ${reason}:`, err?.stack || err);
  Sentry.captureException(err);
  // Give Sentry a moment to flush, then exit so Render restarts us clean.
  // Continuing after an uncaught exception leaves undefined state.
  Sentry.close(2000).then(() => process.exit(1));
};

process.on('unhandledRejection', (reason) => {
  // A rejected promise has not corrupted process state, so log and keep serving.
  console.error('[FATAL] Unhandled promise rejection:', reason?.stack || reason);
  Sentry.captureException(reason);
});

process.on('uncaughtException', (err) => {
  // EPIPE on stdout means something closed our output pipe (e.g. `| head`).
  // It says nothing about application health, so never die for it.
  if (err?.code === 'EPIPE') return;
  shutdown('Uncaught exception', err);
});

// ── Graceful shutdown on deploy/restart ──────────────────────────────────
// Render sends SIGTERM when stopping a process. Without this, an old process
// keeps its node-cron jobs ticking during the deploy overlap window, which
// produces duplicate job runs (visible as doubled cron log lines). Stop all
// cron tasks and close the HTTP server before exiting.
function gracefulShutdown(signal) {
  console.log(`[Shutdown] ${signal} received — stopping cron jobs...`);
  try {
    cron.getTasks().forEach((task) => {
      try {
        task.stop();
      } catch (_) {}
    });
  } catch (err) {
    console.error('[Shutdown] Failed to stop cron jobs:', err.message);
  }

  if (server) {
    server.close(() => {
      console.log('[Shutdown] Server closed. Exiting.');
      process.exit(0);
    });
    // Safety net — don't hang if an open connection refuses to close.
    setTimeout(() => process.exit(0), 5000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
