const request = require('supertest');
const app = require('../app');

// Guards against login CSRF: the callback must only be honoured for the
// browser that started the flow, proven by the signed `state` nonce cookie.
describe('Google OAuth state parameter', () => {
  test('GET /auth/google issues a state nonce and forwards it to Google', async () => {
    const res = await request(app).get('/auth/google');

    expect(res.status).toBe(302);

    const cookie = (res.headers['set-cookie'] || []).find((c) =>
      c.startsWith('g_oauth_state=')
    );
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const location = new URL(res.headers.location);
    expect(location.hostname).toMatch(/google\.com$/);
    expect(location.searchParams.get('state')).toBeTruthy();
  });

  test('callback with no state cookie is rejected', async () => {
    const res = await request(app).get('/auth/google/callback?code=x&state=abc');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/error=invalid_state/);
  });

  test('callback with a mismatched state is rejected', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/google');

    const res = await agent.get('/auth/google/callback?code=x&state=attacker');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/error=invalid_state/);
  });

  test('callback with an unsigned forged state cookie is rejected', async () => {
    const res = await request(app)
      .get('/auth/google/callback?code=x&state=forged')
      .set('Cookie', 'g_oauth_state=forged');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/error=invalid_state/);
  });

  test('the state nonce is single-use — replaying the callback fails', async () => {
    const agent = request.agent(app);
    const start = await agent.get('/auth/google');
    const state = new URL(start.headers.location).searchParams.get('state');

    // First use consumes the cookie (the exchange itself fails without a real
    // Google code, but the state check has already passed by then).
    const first = await agent.get(`/auth/google/callback?code=x&state=${state}`);
    expect(first.headers.location).not.toMatch(/error=invalid_state/);

    const replay = await agent.get(`/auth/google/callback?code=x&state=${state}`);
    expect(replay.headers.location).toMatch(/error=invalid_state/);
  });
});
