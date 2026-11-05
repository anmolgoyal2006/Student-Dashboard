// globalTeardown.js — runs ONCE after all test suites complete.
// Stops the shared MongoMemoryServer started in globalSetup.js.
module.exports = async () => {
  if (global.__MONGOD__) {
    await global.__MONGOD__.stop();
  }
};
