const request = require('supertest');
const app = require('../app');

// Sign up a user and return their bearer token.
async function signupUser(email) {
  const res = await request(app).post('/api/auth/signup').send({
    name: 'User ' + email,
    email,
    password: 'secret123',
  });
  return res.body.token;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('Tasks API', () => {
  test('create a task (happy path) → 201', async () => {
    const token = await signupUser('a@example.com');
    const res = await request(app)
      .post('/api/tasks')
      .set(auth(token))
      .send({ title: 'Finish lab report', dueDate: '2026-08-01' });
    expect(res.status).toBe(201);
    expect(res.body.task.title).toBe('Finish lab report');
  });

  test('create a task with no title → 400 (validation layer)', async () => {
    const token = await signupUser('b@example.com');
    const res = await request(app)
      .post('/api/tasks')
      .set(auth(token))
      .send({ dueDate: '2026-08-01' });
    expect(res.status).toBe(400);
  });

  test('GET /api/tasks/:id with a malformed id → 400, not 500', async () => {
    const token = await signupUser('c@example.com');
    const res = await request(app)
      .get('/api/tasks/not-a-valid-id')
      .set(auth(token));
    expect(res.status).toBe(400);
  });

  test('a user cannot delete another user\'s task (ownership scoping) → 404', async () => {
    const tokenA = await signupUser('owner@example.com');
    const tokenB = await signupUser('attacker@example.com');

    const created = await request(app)
      .post('/api/tasks')
      .set(auth(tokenA))
      .send({ title: 'Private task', dueDate: '2026-08-01' });
    const taskId = created.body.task._id;

    // User B tries to delete User A's task
    const res = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set(auth(tokenB));
    expect(res.status).toBe(404);

    // And it still exists for the real owner
    const stillThere = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set(auth(tokenA));
    expect(stillThere.status).toBe(200);
  });

  test('requests with no token → 401', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });
});
