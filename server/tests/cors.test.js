const request = require('supertest');
const app = require('../app');

// A bare /\.vercel\.app$/ match trusts every site hosted on Vercel, including
// one an attacker deploys for free.
describe('CORS origin policy', () => {
  const check = (origin) =>
    request(app).get('/api/ping').set('Origin', origin);

  test('the production frontend is allowed', async () => {
    const res = await check('https://student-dashboard-ashy-rho.vercel.app');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  test('the bare Vercel project alias is allowed', async () => {
    const res = await check('https://student-dashboard.vercel.app');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  test('localhost dev origin is allowed', async () => {
    const res = await check('http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  test('this project\'s preview deploys are allowed', async () => {
    const res = await check('https://student-dashboard-git-main-anmol.vercel.app');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  test('an unrelated vercel.app site is blocked', async () => {
    const res = await check('https://evil-attacker-site.vercel.app');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('a lookalike domain is blocked', async () => {
    const res = await check('https://student-dashboard-ashy-rho.vercel.app.evil.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('a prefix-squatted vercel subdomain is blocked', async () => {
    const res = await check('https://evil-student-dashboard-x.vercel.app');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('an arbitrary external origin is blocked', async () => {
    const res = await check('https://attacker.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
