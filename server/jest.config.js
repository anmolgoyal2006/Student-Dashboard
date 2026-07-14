module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // Only our real tests — NOT the live-network collector scraper scripts
  // in tests/ and collectors/tests/, which aren't named *.test.js.
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // mongodb-memory-server may download a binary on first run.
  testTimeout: 60000,
};
