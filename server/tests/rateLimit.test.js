const request = require('supertest');
const app = require('../app');

// Proves the authLimiter (10 requests / 15 min per IP) added this session.
// Jest gives each test file its own module registry, so this file's limiter
// store starts fresh at 0 — independent of the other test files.
describe('Rate limiting on auth endpoints', () => {
  test('the 11th rapid login attempt is throttled with 429', async () => {
    const attempt = () =>
      request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'wrongpass' });

    const statuses = [];
    for (let i = 0; i < 12; i++) {
      const res = await attempt();
      statuses.push(res.status);
    }

    // First request is allowed through (401 wrong creds, not throttled).
    expect(statuses[0]).not.toBe(429);
    // The limiter kicks in within the window (limit is 10).
    expect(statuses).toContain(429);
    // The last of 12 is definitely throttled.
    expect(statuses[statuses.length - 1]).toBe(429);
  });
});
