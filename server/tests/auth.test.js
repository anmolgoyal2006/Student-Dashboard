const request = require('supertest');
const app = require('../app');

describe('Auth API', () => {
  const valid = {
    name: 'Test Student',
    email: 'student@example.com',
    password: 'secret123',
  };

  test('POST /api/auth/signup creates a user and returns a token', async () => {
    const res = await request(app).post('/api/auth/signup').send(valid);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(valid.email);
  });

  test('signup with an invalid email → 400 (validation layer)', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...valid, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/valid email/i);
  });

  test('signup with a too-short password → 400 (validation layer)', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...valid, password: '123' });
    expect(res.status).toBe(400);
  });

  test('login with the wrong password → 401', async () => {
    await request(app).post('/api/auth/signup').send(valid);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: valid.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  test('login with correct credentials → token', async () => {
    await request(app).post('/api/auth/signup').send(valid);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: valid.email, password: valid.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});
