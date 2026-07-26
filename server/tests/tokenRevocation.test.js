const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const { versionCache } = require('../middleware/authMiddleware');

// A JWT cannot be withdrawn on its own, so without a version check a token
// copied off a device keeps working for its full 7-day life — through logout,
// through a password change, through a password reset.
describe('JWT revocation via tokenVersion', () => {
  const creds = { name: 'Rev User', email: 'rev@example.com', password: 'secret123' };

  const signup = async () => {
    const res = await request(app).post('/api/auth/signup').send(creds);
    expect(res.status).toBe(201);
    return res.body.token;
  };

  beforeEach(() => versionCache.clear());

  test('issued tokens carry a tokenVersion claim', async () => {
    const token = await signup();
    expect(jwt.decode(token).tokenVersion).toBe(0);
  });

  test('a valid token is accepted', async () => {
    const token = await signup();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('logout-all invalidates the token that called it', async () => {
    const token = await signup();

    const out = await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${token}`);
    expect(out.status).toBe(200);

    versionCache.clear(); // skip the 30s cache window
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/session expired/i);
  });

  test('a second device is also signed out by logout-all', async () => {
    const deviceA = await signup();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: creds.password });
    const deviceB = login.body.token;

    await request(app).post('/api/auth/logout-all').set('Authorization', `Bearer ${deviceA}`);
    versionCache.clear();

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${deviceB}`);
    expect(res.status).toBe(401);
  });

  test('a stale tokenVersion is rejected, a fresh login works', async () => {
    const stale = await signup();
    await User.updateOne({ email: creds.email }, { $inc: { tokenVersion: 1 } });
    versionCache.clear();

    const rejected = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${stale}`);
    expect(rejected.status).toBe(401);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: creds.password });
    expect(jwt.decode(login.body.token).tokenVersion).toBe(1);

    const accepted = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(accepted.status).toBe(200);
  });

  test('changing the password revokes existing sessions', async () => {
    const token = await signup();

    const changed = await request(app)
      .put('/api/user/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ oldPassword: creds.password, newPassword: 'brandnew456' });
    expect(changed.status).toBe(200);

    versionCache.clear();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  test('a token for a deleted user is rejected', async () => {
    const token = await signup();
    await User.deleteOne({ email: creds.email });
    versionCache.clear();

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  test('a forged tokenVersion does not bypass the check', async () => {
    await signup();
    await User.updateOne({ email: creds.email }, { $inc: { tokenVersion: 5 } });
    versionCache.clear();

    // Correct version but signed with the wrong secret — signature must win.
    const user = await User.findOne({ email: creds.email });
    const forged = jwt.sign(
      { id: user._id, email: user.email, role: user.role, tokenVersion: 5 },
      'not-the-real-secret',
      { expiresIn: '1h' }
    );

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });
});
