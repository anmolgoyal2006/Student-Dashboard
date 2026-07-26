const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Task = require('../models/Task');
const Subject = require('../models/Subject');

// Passing req.body straight into an update lets a client write fields the API
// never meant to expose — most importantly the ownership key, which would hand
// the document to another account.
describe('Mass assignment on update', () => {
  let attacker, victim, attackerToken;

  const tokenFor = (user) =>
    jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

  beforeEach(async () => {
    attacker = await User.create({ name: 'A', email: 'a@example.com', password: 'hashed-placeholder', role: 'student' });
    victim   = await User.create({ name: 'V', email: 'v@example.com', password: 'hashed-placeholder', role: 'student' });
    attackerToken = tokenFor(attacker);
  });

  test('updateTask cannot reassign the task to another user', async () => {
    const task = await Task.create({
      user: attacker._id,
      title: 'Mine',
      dueDate: new Date('2030-01-01'),
    });

    const res = await request(app)
      .put(`/api/tasks/${task._id}`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ title: 'Renamed', user: victim._id.toString() });

    expect(res.status).toBe(200);

    const after = await Task.findById(task._id);
    expect(after.title).toBe('Renamed');            // legit field applied
    expect(String(after.user)).toBe(String(attacker._id)); // ownership untouched
  });

  test('updateTask ignores unknown fields entirely', async () => {
    const task = await Task.create({
      user: attacker._id,
      title: 'Mine',
      dueDate: new Date('2030-01-01'),
    });

    await request(app)
      .put(`/api/tasks/${task._id}`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ title: 'Ok', isAdmin: true, injected: 'nope' });

    const after = await Task.findById(task._id).lean();
    expect(after.isAdmin).toBeUndefined();
    expect(after.injected).toBeUndefined();
  });

  test('updateSubject cannot reassign the subject to another user', async () => {
    const subject = await Subject.create({ userId: attacker._id, name: 'Physics' });

    const res = await request(app)
      .put(`/api/subjects/${subject._id}`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ name: 'Chemistry', userId: victim._id.toString() });

    expect(res.status).toBe(200);

    const after = await Subject.findById(subject._id);
    expect(after.name).toBe('Chemistry');
    expect(String(after.userId)).toBe(String(attacker._id));
  });

  test('a user still cannot update another user\'s task', async () => {
    const victimTask = await Task.create({
      user: victim._id,
      title: 'Victim task',
      dueDate: new Date('2030-01-01'),
    });

    const res = await request(app)
      .put(`/api/tasks/${victimTask._id}`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ title: 'Hijacked' });

    expect(res.status).toBe(404);
    const after = await Task.findById(victimTask._id);
    expect(after.title).toBe('Victim task');
  });
});
