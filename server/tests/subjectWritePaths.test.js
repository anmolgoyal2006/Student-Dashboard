const request = require('supertest');
const jwt = require('jsonwebtoken');

// See helpers/mockAiService — jest.spyOn cannot intercept the controller's
// destructured chatCompletionsCreate binding, so the module is mocked outright.
jest.mock('../services/aiService', () => require('./helpers/mockAiService').factory());
const { mockGeminiJSON, resetGemini } = require('./helpers/mockAiService');

const app = require('../app');
const User = require('../models/User');
const Subject = require('../models/Subject');

// Characterization tests: these pin the CURRENT behaviour of the two independent
// subject write paths so the extraction into subjectService can be proven to be
// a pure refactor. They assert what the code does today, not what it should do.
describe('Subject write paths (characterization)', () => {
  let user, token;

  beforeEach(async () => {
    user = await User.create({
      name: 'S', email: 's@example.com', password: 'hashed-placeholder', role: 'student',
    });
    token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterEach(() => resetGemini());

  // Drives handleCommand by stubbing Gemini's reply with a canned command.
  const aiCommand = (command, body = {}) => {
    mockGeminiJSON(command);
    return request(app)
      .post('/api/ai-command')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'do it', ...body });
  };

  describe('AI path — createSubject', () => {
    test('creates a subject and auto-derives code from name', async () => {
      const res = await aiCommand({
        action: 'add', entity: 'subject',
        data: { name: 'Data Structures' }, message: 'ok',
      });

      expect(res.status).toBe(200);
      const saved = await Subject.findOne({ userId: user._id });
      expect(saved.name).toBe('Data Structures');
      expect(saved.code).toBe('DATAST'); // uppercase, non-alnum stripped, 6 chars
    });

    test('an existing name is skipped, not duplicated', async () => {
      await Subject.create({ userId: user._id, name: 'Physics' });

      // Case-insensitive anchored match — 'physics' must collide with 'Physics'.
      const res = await aiCommand({
        action: 'add', entity: 'subject',
        data: { name: 'physics' }, message: 'ok',
      });

      expect(res.body.success).toBe(false);
      expect(await Subject.countDocuments({ userId: user._id })).toBe(1);
    });
  });

  describe('AI path — schedule merge', () => {
    const seed = () => Subject.create({
      userId: user._id,
      name: 'Physics',
      schedule: [
        { day: 'Mon', startTime: '09:00', endTime: '10:00', room: 'A1' },
        { day: 'Wed', startTime: '11:00', endTime: '12:00', room: 'B2' },
      ],
    });

    test('a slot on an existing day replaces that day, other days survive', async () => {
      await seed();

      await aiCommand({
        action: 'add', entity: 'subject',
        data: { name: 'Physics', schedule: [{ day: 'Mon', startTime: '14:00', endTime: '15:00', room: 'C3' }] },
        message: 'ok',
      });

      const saved = await Subject.findOne({ userId: user._id });
      const byDay = Object.fromEntries(saved.schedule.map((s) => [s.day, s]));
      expect(saved.schedule).toHaveLength(2);
      expect(byDay.Mon.startTime).toBe('14:00'); // replaced
      expect(byDay.Mon.room).toBe('C3');
      expect(byDay.Wed.startTime).toBe('11:00'); // untouched
    });

    test('a slot on a new day is appended after the kept slots', async () => {
      await seed();

      await aiCommand({
        action: 'add', entity: 'subject',
        data: { name: 'Physics', schedule: [{ day: 'Fri', startTime: '08:00', endTime: '09:00', room: 'D4' }] },
        message: 'ok',
      });

      const saved = await Subject.findOne({ userId: user._id });
      // Order matters: kept slots first, then the new ones concatenated.
      expect(saved.schedule.map((s) => s.day)).toEqual(['Mon', 'Wed', 'Fri']);
    });

    test('bulk add merges into an existing subject and creates new ones', async () => {
      await seed();

      const res = await aiCommand({
        action: 'add', entity: 'subject',
        data: {
          items: [
            { name: 'Physics', schedule: [{ day: 'Mon', startTime: '16:00', endTime: '17:00', room: 'Z9' }] },
            { name: 'Chemistry', schedule: [{ day: 'Tue', startTime: '10:00', endTime: '11:00', room: 'L1' }] },
          ],
        },
        message: 'ok',
      });

      expect(res.body.success).toBe(true);
      const physics = await Subject.findOne({ userId: user._id, name: 'Physics' });
      const chem = await Subject.findOne({ userId: user._id, name: 'Chemistry' });
      expect(physics.schedule.find((s) => s.day === 'Mon').startTime).toBe('16:00');
      expect(physics.schedule.map((s) => s.day)).toEqual(['Wed', 'Mon']);
      expect(chem.code).toBe('CHEMIS');
    });

    test('update action merges schedule by day and sets scalar fields', async () => {
      await seed();

      await aiCommand({
        action: 'update', entity: 'subject',
        data: {
          name: 'Physics',
          credits: 4,
          instructor: 'Prof. Rao',
          schedule: [{ day: 'Wed', startTime: '13:00', endTime: '14:00', room: 'X1' }],
        },
        message: 'ok',
      });

      const saved = await Subject.findOne({ userId: user._id });
      expect(saved.credits).toBe(4);
      expect(saved.instructor).toBe('Prof. Rao');
      expect(saved.schedule.map((s) => s.day)).toEqual(['Mon', 'Wed']);
      expect(saved.schedule.find((s) => s.day === 'Wed').startTime).toBe('13:00');
    });
  });

  describe('REST path', () => {
    test('POST /api/subjects creates and derives code via the pre-save hook', async () => {
      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Operating Systems', schedule: [{ day: 'Thu', startTime: '09:00', endTime: '10:00' }] });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Subject added');
      expect(res.body.subject.code).toBe('OPERAT');
    });

    test('POST rejects a duplicate name with 409', async () => {
      await Subject.create({ userId: user._id, name: 'Physics' });

      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'physics' });

      expect(res.status).toBe(409);
      expect(await Subject.countDocuments({ userId: user._id })).toBe(1);
    });

    test('POST rejects a day outside the enum', async () => {      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bad Day', schedule: [{ day: 'Monday', startTime: '09:00', endTime: '10:00' }] });

      expect(res.status).toBe(400);
    });

    test('PUT replaces the whole schedule array (no merge on the REST path)', async () => {      const subject = await Subject.create({
        userId: user._id,
        name: 'Maths',
        schedule: [
          { day: 'Mon', startTime: '09:00', endTime: '10:00' },
          { day: 'Wed', startTime: '11:00', endTime: '12:00' },
        ],
      });

      const res = await request(app)
        .put(`/api/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ schedule: [{ day: 'Fri', startTime: '15:00', endTime: '16:00' }] });

      expect(res.status).toBe(200);
      const saved = await Subject.findById(subject._id);
      expect(saved.schedule.map((s) => s.day)).toEqual(['Fri']);
    });
  });
});
