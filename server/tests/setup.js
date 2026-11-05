// Test lifecycle: connects to the shared MongoMemoryServer started in
// globalSetup.js, and sets hermetic env vars before any app code loads.
// No test ever touches the real Atlas DB, Gemini, Firebase, or Sentry.
//
// Using globalSetup/globalTeardown for the MongoDB binary means it is
// started ONCE for the whole suite instead of once per test file (21×),
// which was exhausting memory and crashing with exit code 14.

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.SENTRY_DSN = '';
process.env.GEMINI_API_KEY = 'test-key';
process.env.GOOGLE_AUTH_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_AUTH_CLIENT_SECRET = 'test-client-secret';

const mongoose = require('mongoose');

// Increased timeout: first connection attempt after globalSetup may be slow.
jest.setTimeout(120000);

beforeAll(async () => {
  const uri = process.env.MONGO_TEST_URI;
  if (!uri) throw new Error('[setup] MONGO_TEST_URI not set — globalSetup.js may have failed');

  // If a previous test file left the connection open and pointing at the right
  // URI, reuse it rather than reconnecting (mongoose caches connections).
  if (mongoose.connection.readyState === 1) return;

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
}, 60000);

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  // Do NOT stop the server here — globalTeardown.js does that once at the end.
  // Just close this file's mongoose connection so the next test file gets a
  // clean connection state.
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  } catch (_) {}
}, 60000);
