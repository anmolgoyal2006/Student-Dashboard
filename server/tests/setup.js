// Test lifecycle: spin up an in-memory MongoDB, point Mongoose at it, and
// set hermetic env vars BEFORE any app code is required by a test. No test
// ever touches the real Atlas DB, real Gemini/Firebase/OAuth, or Sentry.

// Env must be set before app.js / controllers are required by test files.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.SENTRY_DSN = '';            // Sentry no-ops with empty DSN
process.env.GEMINI_API_KEY = 'test-key';
process.env.GOOGLE_AUTH_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_AUTH_CLIENT_SECRET = 'test-client-secret';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  // Clear all collections between tests so each test starts clean.
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongo) await mongo.stop();
});
