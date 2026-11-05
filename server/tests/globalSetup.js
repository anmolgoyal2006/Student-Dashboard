// globalSetup.js — runs ONCE before all test suites in the Jest process.
// Starts a single MongoMemoryServer instance and writes its URI to an
// environment variable that setup.js reads. This prevents the binary from
// being spawned/killed for every test file (21 times), which exhausted
// memory and caused exit-code-14 crashes on constrained machines.
const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();

  // Store on global so globalTeardown can stop it.
  global.__MONGOD__ = mongo;

  // Make the URI available to every test worker via environment variable.
  process.env.MONGO_TEST_URI = uri;
};
