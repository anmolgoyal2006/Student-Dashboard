// performance-audit/benchmark-server.js
// Dedicated isolated HTTP server for benchmarking on port 5050.

const path = require('path');
module.paths.push(path.join(__dirname, '../server/node_modules'));

const mongoose = require('mongoose');
const app = require('../server/app');

// Explicitly override dotenv values that instrument.js may have reloaded
const BENCHMARK_DB_URI = process.env.MONGO_BENCHMARK_URI || 'mongodb://127.0.0.1:27017/student-benchmark';
const BENCHMARK_JWT_SECRET = 'benchmark-super-secret-key-2026';
process.env.MONGO_URI = BENCHMARK_DB_URI;
process.env.MONGODB_URI = BENCHMARK_DB_URI;
process.env.JWT_SECRET = BENCHMARK_JWT_SECRET;
process.env.PORT = '5050';
process.env.NODE_ENV = 'production';
process.env.SENTRY_DSN = '';

let serverInstance = null;

async function startBenchmarkServer(port = 5050) {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(BENCHMARK_DB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
  }

  return new Promise((resolve) => {
    serverInstance = app.listen(port, '127.0.0.1', () => {
      console.log(`[Benchmark Server] Listening on http://127.0.0.1:${port}`);
      resolve(serverInstance);
    });
  });
}

async function stopBenchmarkServer() {
  if (serverInstance) {
    await new Promise((resolve) => serverInstance.close(resolve));
    console.log('[Benchmark Server] HTTP server closed.');
  }
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log('[Benchmark Server] DB connection closed.');
  }
}

if (require.main === module) {
  startBenchmarkServer().then(() => {
    console.log('Ready for benchmark requests. Press Ctrl+C to stop.');
  }).catch(err => {
    console.error('Failed to start benchmark server:', err);
    process.exit(1);
  });
}

module.exports = { startBenchmarkServer, stopBenchmarkServer, app };
