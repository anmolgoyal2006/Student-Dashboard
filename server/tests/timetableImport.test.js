const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../services/aiService', () => require('./helpers/mockAiService').factory());
const mockRenderPDF = jest.fn();
jest.mock('../services/pdfParser', () => ({
  ...jest.requireActual('../services/pdfParser'),
  extractTextFromPDF: jest.fn(),
  renderPDFPagesToImages: mockRenderPDF,
}));

const { mockGeminiVisionJSON, mockGeminiVisionRaw, resetGemini } = require('./helpers/mockAiService');
const { flagEntry } = require('../services/timetableImportService');
const app = require('../app');
const User = require('../models/User');
const Subject = require('../models/Subject');

describe('Timetable PDF import', () => {
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
    mockRenderPDF.mockResolvedValue([
      { mimeType: 'image/jpeg', data: 'fakebase64data' },
    ]);
  });

  afterEach(() => {
    resetGemini();
    mockRenderPDF.mockReset();
  });

  const upload = () =>
    request(app)
      .post('/api/subjects/import-pdf')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF-1.4 fake'), 'timetable.pdf');

  describe('parse', () => {
    test('returns entries and a flagged count', async () => {
      mockGeminiVisionJSON({
        subjects: [{
          name: 'Data Structures', code: 'CS201', instructor: '', credits: 4,
          schedule: [
            { day: 'Mon', startTime: '09:00', endTime: '10:00', room: 'A1' },
            { day: 'Wed', startTime: '11:00', endTime: '12:00', room: 'A1' },
          ],
        }],
      });

      const res = await upload();

      expect(res.status).toBe(200);
      expect(res.body.flagged).toBe(0);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.entries[0].schedule).toHaveLength(2);
      expect(res.body.entries[0].issues).toEqual([]);
    });

    test('a partial row is flagged per field, not dropped', async () => {
      mockGeminiVisionJSON({
        subjects: [
          { name: 'Physics', schedule: [{ day: 'Mon', startTime: '09:00', endTime: '10:00' }] },
          { name: '', credits: 99, schedule: [{ day: 'Funday', startTime: '9am', endTime: '' }] },
        ],
      });

      const res = await upload();

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(2); // the bad row survives for review
      expect(res.body.flagged).toBe(1);

      const fields = res.body.entries[1].issues.map((i) => i.field);
      expect(fields).toContain('name');
      expect(fields).toContain('credits');
      expect(fields).toContain('schedule.0.day');
      expect(fields).toContain('schedule.0.startTime');
      expect(fields).toContain('schedule.0.endTime');
    });

    test('one bad row does not reject the whole import', async () => {
      mockGeminiVisionJSON({
        subjects: [
          { name: 'Good', schedule: [{ day: 'Tue', startTime: '10:00', endTime: '11:00' }] },
          { name: 'Bad', schedule: [] },
        ],
      });

      const res = await upload();
      expect(res.status).toBe(200);
      expect(res.body.entries.map((e) => e.name)).toEqual(['Good', 'Bad']);
    });

    test('rows for the same course are folded into one subject', async () => {
      // Real timetables list a course once per teacher/session block. Leaving
      // them split loses every slot after the first, since createSubject
      // dedupes by name on write.
      mockGeminiVisionJSON({
        subjects: [
          {
            name: 'SC', code: 'CSN5002', instructor: 'Dr. Dipika',
            schedule: [{ day: 'Mon', startTime: '14:00', endTime: '15:00', room: 'L21' }],
          },
          {
            name: 'SC', code: 'CSN5002', instructor: 'Dr. Neeraj',
            schedule: [{ day: 'Thu', startTime: '09:00', endTime: '10:00', room: 'L406' }],
          },
        ],
      });

      const res = await upload();

      expect(res.body.entries).toHaveLength(1);
      expect(res.body.entries[0].schedule.map((s) => s.day)).toEqual(['Mon', 'Thu']);
      expect(res.body.entries[0].instructor).toBe('Dr. Dipika');
    });

    test('a duplicate row supplies the slots its twin was missing', async () => {
      mockGeminiVisionJSON({
        subjects: [
          { name: 'Lab', code: 'CS9', schedule: [] },
          { name: 'Lab', code: 'CS9', schedule: [{ day: 'Fri', startTime: '09:00', endTime: '11:00' }] },
        ],
      });

      const res = await upload();

      expect(res.body.entries).toHaveLength(1);
      expect(res.body.flagged).toBe(0); // the "no class times" flag must clear
    });

    test('different courses are not folded together', async () => {
      mockGeminiVisionJSON({
        subjects: [
          { name: 'SE', code: 'CSN5003', schedule: [{ day: 'Mon', startTime: '08:00', endTime: '09:00' }] },
          { name: 'SC', code: 'CSN5002', schedule: [{ day: 'Mon', startTime: '14:00', endTime: '15:00' }] },
        ],
      });

      const res = await upload();
      expect(res.body.entries).toHaveLength(2);
    });

    test('a corrupt PDF returns 422', async () => {
      mockRenderPDF.mockRejectedValueOnce(new Error('corrupt PDF'));

      const res = await upload();

      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/could not be read/i);
    });

    test('a non-timetable PDF returns 422 rather than an empty success', async () => {
      mockGeminiVisionRaw('I am not able to find a timetable here.');

      const res = await upload();

      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/could not find any classes/i);
    });

    test('a marks sheet — valid JSON, zero subjects — also returns 422', async () => {
      // The model reads a result sheet or syllabus fine and correctly reports no
      // classes. That is a dead end for the user, not a successful import.
      mockGeminiVisionJSON({ subjects: [] });

      const res = await upload();

      expect(res.status).toBe(422);
      expect(res.body.hint).toMatch(/result sheets|syllabi/i);
    });

    test('fenced JSON from the model is still parsed', async () => {
      mockGeminiVisionRaw('```json\n{"subjects":[{"name":"Maths","schedule":[{"day":"Fri","startTime":"14:00","endTime":"15:00"}]}]}\n```');

      const res = await upload();

      expect(res.status).toBe(200);
      expect(res.body.entries[0].name).toBe('Maths');
    });

    test('a non-PDF upload is rejected', async () => {
      const res = await request(app)
        .post('/api/subjects/import-pdf')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('hello'), 'notes.txt');

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(await Subject.countDocuments({})).toBe(0);
    });

    test('requires authentication', async () => {
      const res = await request(app)
        .post('/api/subjects/import-pdf')
        .attach('file', Buffer.from('%PDF-1.4'), 'timetable.pdf');
      expect(res.status).toBe(401);
    });
  });

  describe('confirm', () => {
    const confirm = (subjects) =>
      request(app)
        .post('/api/subjects/import-pdf/confirm')
        .set('Authorization', `Bearer ${token}`)
        .send({ subjects });

    test('writes through createSubject, deriving code and scoping to the user', async () => {
      const res = await confirm([
        { name: 'Data Structures', schedule: [{ day: 'Mon', startTime: '09:00', endTime: '10:00', room: 'A1' }] },
      ]);

      expect(res.status).toBe(201);
      const saved = await Subject.findOne({ name: 'Data Structures' });
      expect(saved.code).toBe('DATAST');           // createSubject's derivation
      expect(String(saved.userId)).toBe(String(user._id));
    });

    test('an already-existing subject is reported as skipped, not duplicated', async () => {
      await Subject.create({ userId: user._id, name: 'Physics' });

      const res = await confirm([
        { name: 'Physics', schedule: [{ day: 'Mon', startTime: '09:00', endTime: '10:00' }] },
        { name: 'Chemistry', schedule: [{ day: 'Tue', startTime: '09:00', endTime: '10:00' }] },
      ]);

      expect(res.status).toBe(201);
      expect(res.body.skipped).toEqual(['Physics']);
      expect(res.body.subjects).toHaveLength(1);
      expect(await Subject.countDocuments({ userId: user._id })).toBe(2);
    });

    test('an invalid day is rejected by the route validators', async () => {
      const res = await confirm([
        { name: 'Bad', schedule: [{ day: 'Funday', startTime: '09:00', endTime: '10:00' }] },
      ]);

      expect(res.status).toBe(400);
      expect(await Subject.countDocuments({})).toBe(0);
    });

    test('an empty list is rejected', async () => {
      const res = await confirm([]);
      expect(res.status).toBe(400);
    });
  });

  describe('flagEntry', () => {
    test('accepts null credits without flagging — absent is not invalid', () => {
      const { issues } = flagEntry({
        name: 'X', credits: null,
        schedule: [{ day: 'Mon', startTime: '09:00', endTime: '10:00' }],
      });
      expect(issues).toEqual([]);
    });

    test('rejects a 12-hour time that the model failed to convert', () => {
      const { issues } = flagEntry({
        name: 'X', schedule: [{ day: 'Mon', startTime: '2:00 PM', endTime: '15:00' }],
      });
      expect(issues.map((i) => i.field)).toEqual(['schedule.0.startTime']);
    });

    test('flags a subject with no class times', () => {
      const { issues } = flagEntry({ name: 'X', schedule: [] });
      expect(issues.map((i) => i.field)).toContain('schedule');
    });
  });
});
