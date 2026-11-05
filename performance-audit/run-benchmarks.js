// performance-audit/run-benchmarks.js
// Automated HTTP load testing harness using Autocannon.
// Concurrency levels: 1, 10, 25, 50 connections.
// Measures p50, p95, p99, average latency, RPS, and error rate.

const path = require('path');
module.paths.push(path.join(__dirname, '../server/node_modules'));

const autocannon = require('autocannon');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const fs = require('fs');
const http = require('http');

const User = require('../server/models/User');
const { BENCHMARK_USER, JWT_SECRET, MONGO_BENCHMARK_URI } = require('./seed-benchmark-db');
const { startBenchmarkServer, stopBenchmarkServer } = require('./benchmark-server');

const CONCURRENCY_LEVELS = [1, 10, 25, 50];
const TEST_DURATION_SECS = 5;
const WARMUP_DURATION_SECS = 2;
const PORT = 5050;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const TARGET_ENDPOINTS = [
  {
    name: 'Student Dashboard',
    path: '/api/decision/today-plan',
    description: 'Personalized intelligence plan aggregating Attendance, Marks, Career, Classroom',
  },
  {
    name: 'Attendance Retrieval',
    path: '/api/attendance/summary',
    description: 'Attendance statistics, current streaks, shortage calculations, miss predictions',
  },
  {
    name: 'Attendance Trends',
    path: '/api/attendance/trends',
    description: 'Monthly historical attendance trends and period analysis',
  },
  {
    name: 'Marks Retrieval',
    path: '/api/marks/cgpa-semester',
    description: 'Multi-semester SGPA breakdown and weighted cumulative CGPA',
  },
  {
    name: 'Timetable Retrieval',
    path: '/api/timetable',
    description: 'Student course schedule, credits, instructors, and meeting slots',
  },
  {
    name: 'AI Notes Retrieval',
    path: '/api/ai/notes',
    description: 'RAG note documents aggregation, chunk counts, and timestamps',
  },
];

async function getAuthToken() {
  await mongoose.connect(MONGO_BENCHMARK_URI);
  const user = await User.findOne({ email: BENCHMARK_USER.email });
  if (!user) throw new Error('Benchmark user not found. Run seed script first.');

  const token = jwt.sign(
    {
      id: user._id,
      _id: user._id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  await mongoose.connection.close();
  return token;
}

function runAutocannon(opts) {
  return new Promise((resolve, reject) => {
    autocannon(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

async function verifyEndpoint(url, headers) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, bodyLength: body.length });
        } else {
          reject(new Error(`Endpoint ${url} returned status ${res.statusCode}: ${body.slice(0, 100)}`));
        }
      });
    });
    req.on('error', reject);
  });
}

async function runSuite(mode = 'baseline') {
  console.log(`\n========================================================================`);
  console.log(`🚀 STARTING AUTOCANNON LOAD TEST SUITE (Mode: ${mode.toUpperCase()})`);
  console.log(`========================================================================\n`);

  console.log('[1/4] Generating authenticated JWT test token...');
  const token = await getAuthToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };

  console.log('[2/4] Starting isolated benchmark HTTP server...');
  await startBenchmarkServer(PORT);

  console.log('[3/4] Verifying all target endpoints respond with HTTP 200...');
  for (const ep of TARGET_ENDPOINTS) {
    const check = await verifyEndpoint(`${BASE_URL}${ep.path}`, headers);
    console.log(`  ✓ ${ep.name.padEnd(25)} (${ep.path}) -> HTTP ${check.status} (${check.bodyLength} bytes)`);
  }

  const allResults = {
    timestamp: new Date().toISOString(),
    mode,
    nodeVersion: process.version,
    platform: process.platform,
    concurrencyLevels: CONCURRENCY_LEVELS,
    durationSecs: TEST_DURATION_SECS,
    warmupSecs: WARMUP_DURATION_SECS,
    endpoints: {},
  };

  console.log('\n[4/4] Executing benchmark matrix across concurrency levels [1, 10, 25, 50]...\n');

  for (const ep of TARGET_ENDPOINTS) {
    console.log(`\n------------------------------------------------------------------------`);
    console.log(`Testing: ${ep.name} (${ep.path})`);
    console.log(`------------------------------------------------------------------------`);
    allResults.endpoints[ep.name] = {
      path: ep.path,
      description: ep.description,
      concurrency: {},
    };

    for (const connections of CONCURRENCY_LEVELS) {
      process.stdout.write(`  • Concurrency: ${connections.toString().padStart(2)} connections | Warming up... `);

      // Warm-up run
      await runAutocannon({
        url: `${BASE_URL}${ep.path}`,
        connections: Math.min(connections, 10),
        duration: WARMUP_DURATION_SECS,
        headers,
      });

      process.stdout.write('Testing... ');

      // Actual measurement
      const result = await runAutocannon({
        url: `${BASE_URL}${ep.path}`,
        connections,
        duration: TEST_DURATION_SECS,
        headers,
      });

      const totalRequests = result.requests.total;
      const totalErrors = (result.errors || 0) + (result.timeouts || 0) + (result.non2xx || 0);
      const errorRatePct = totalRequests > 0 ? +((totalErrors / totalRequests) * 100).toFixed(2) : 0;

      const p50 = result.latency.p50 ?? 0;
      const p95 = result.latency.p95 ?? result.latency.p97_5 ?? result.latency.p90 ?? 0;
      const p99 = result.latency.p99 ?? 0;
      const p90 = result.latency.p90 ?? 0;
      const avg = +(result.latency.average || 0).toFixed(2);

      const metrics = {
        connections,
        requestsPerSec: Math.round(result.requests.average || 0),
        totalRequests,
        latency: {
          averageMs: avg,
          p50Ms: p50,
          p90Ms: p90,
          p95Ms: p95,
          p99Ms: p99,
          minMs: result.latency.min || 0,
          maxMs: result.latency.max || 0,
        },
        throughputBytesPerSec: Math.round(result.throughput.average || 0),
        errors: totalErrors,
        errorRatePct,
      };

      allResults.endpoints[ep.name].concurrency[connections] = metrics;

      console.log(`RPS: ${metrics.requestsPerSec.toString().padStart(5)} | p50: ${p50.toString().padStart(3)}ms | p95: ${p95.toString().padStart(3)}ms | p99: ${p99.toString().padStart(3)}ms | Avg: ${avg.toFixed(1).padStart(5)}ms | Err: ${errorRatePct}%`);
    }
  }

  const outputFile = path.join(__dirname, `${mode}-results.json`);
  fs.writeFileSync(outputFile, JSON.stringify(allResults, null, 2));
  console.log(`\n========================================================================`);
  console.log(`✅ BENCHMARK RUN COMPLETED: Saved to ${outputFile}`);
  console.log(`========================================================================\n`);

  await stopBenchmarkServer();
  return allResults;
}

if (require.main === module) {
  const mode = process.argv.includes('--mode=optimized') ? 'optimized' : 'baseline';
  runSuite(mode).then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('Benchmark suite failed:', err);
    process.exit(1);
  });
}

module.exports = { runSuite, TARGET_ENDPOINTS };
