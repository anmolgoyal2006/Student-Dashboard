module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // Only our real tests — NOT the live-network collector scraper scripts
  // in tests/ and collectors/tests/, which aren't named *.test.js.
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // mongodb-memory-server may download a binary on first run.
  testTimeout: 60000,
  // Coverage
  collectCoverage: false, // driven by --coverage flag; keeps normal runs fast
  collectCoverageFrom: [
    '**/*.js',
    '!server.js',          // entry point — hard to unit-test in isolation
    '!jest.config.js',
    '!scripts/**',
    '!collectors/**',
    '!tests/**',
    '!node_modules/**',
  ],
  coverageReporters: ['text', 'lcov', 'text-summary'],
  coverageDirectory: 'coverage',
};
