// server/tests/performanceRegression.test.js
// Regression test suite for performance optimizations:
// 1. Validates index coverage across optimized collections.
// 2. Asserts student data isolation (cross-user data leak prevention).
// 3. Verifies API response contract compatibility with frontend expectations.

const request  = require('supertest');
const app      = require('../app');
const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');

const User                = require('../models/User');
const Subject             = require('../models/Subject');
const Attendance          = require('../models/Attendance');
const Marks               = require('../models/Marks');
const Semester            = require('../models/Semester.model');
const ClassroomAssignment = require('../models/ClassroomAssignment');
const NoteChunk           = require('../models/NoteChunk');

function makeToken(user) {
  return jwt.sign(
    {
      id: user._id,
      _id: user._id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion || 0,
    },
    process.env.JWT_SECRET || 'test-jwt-secret',
    { expiresIn: '1h' }
  );
}

describe('Performance Optimizations & Data Isolation Regression Suite', () => {
  let userA, tokenA;
  let userB, tokenB;
  let subjectA, subjectB;

  beforeEach(async () => {
    userA = await User.create({
      name: 'Student A',
      email: 'student_a@test.local',
      password: 'password123',
      tokenVersion: 0,
    });
    tokenA = makeToken(userA);

    userB = await User.create({
      name: 'Student B',
      email: 'student_b@test.local',
      password: 'password123',
      tokenVersion: 0,
    });
    tokenB = makeToken(userB);

    subjectA = await Subject.create({
      userId: userA._id,
      name: 'Computer Architecture',
      code: 'CS201',
      credits: 4,
    });

    subjectB = await Subject.create({
      userId: userB._id,
      name: 'Quantum Physics',
      code: 'PH301',
      credits: 3,
    });

    // Create attendance for user A
    await Attendance.create({
      userId: userA._id,
      subjectId: subjectA._id,
      date: new Date(),
      status: 'present',
      slot: 'Mon',
    });

    // Create marks and semester for user A
    await Marks.create({
      userId: userA._id,
      subjectId: subjectA._id,
      examType: 'final',
      marksObtained: 85,
      maxMarks: 100,
    });

    await Semester.create({
      student: userA._id,
      semesterNumber: 1,
      semesterName: 'Sem 1',
      subjects: [{ name: 'Computer Architecture', credits: 4, grade: 'A' }],
    });

    // Create NoteChunk for user A
    await NoteChunk.create({
      user: userA._id,
      filename: 'Architecture_Notes.pdf',
      chunkIndex: 0,
      text: 'Pipelining hazards and forwarding paths.',
      embedding: [0.1, 0.2, 0.3],
    });
  });

  // ── 1. Index Coverage Assertions ─────────────────────────────────────────
  describe('Index Coverage Assertions', () => {
    it('NoteChunk has index on user and compound index on user + filename', () => {
      const indexes = NoteChunk.schema.indexes();
      const hasUserIndex = indexes.some(([idx]) => idx.user === 1 && Object.keys(idx).length === 1);
      const hasCompoundIndex = indexes.some(([idx]) => idx.user === 1 && idx.filename === 1);
      expect(hasUserIndex).toBe(true);
      expect(hasCompoundIndex).toBe(true);
    });

    it('Semester has compound index on student + semesterNumber', () => {
      const indexes = Semester.schema.indexes();
      const hasIndex = indexes.some(([idx]) => idx.student === 1 && idx.semesterNumber === 1);
      expect(hasIndex).toBe(true);
    });

    it('Marks has compound indexes for examType and examDate', () => {
      const indexes = Marks.schema.indexes();
      const hasExamTypeIndex = indexes.some(([idx]) => idx.userId === 1 && idx.examType === 1);
      const hasExamDateIndex = indexes.some(([idx]) => idx.userId === 1 && idx.examDate === -1);
      expect(hasExamTypeIndex).toBe(true);
      expect(hasExamDateIndex).toBe(true);
    });

    it('ClassroomAssignment has ESR compound index on userId + dueDate + status', () => {
      const indexes = ClassroomAssignment.schema.indexes();
      const hasESRIndex = indexes.some(([idx]) => idx.userId === 1 && idx.dueDate === 1 && idx.status === 1);
      expect(hasESRIndex).toBe(true);
    });
  });

  // ── 2. Student Data Isolation ───────────────────────────────────────────
  describe('Strict Student Data Isolation', () => {
    it('User B cannot see User A timetable / subjects', async () => {
      const res = await request(app)
        .get('/api/timetable')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.subjects).toHaveLength(1);
      expect(res.body.subjects[0].name).toBe('Quantum Physics');
      expect(res.body.subjects.some(s => s.name === 'Computer Architecture')).toBe(false);
    });

    it('User B cannot see User A attendance summary', async () => {
      const res = await request(app)
        .get('/api/attendance/summary')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.summary).toHaveLength(1);
      expect(res.body.summary[0].subject).toBe('Quantum Physics');
      expect(res.body.summary[0].total).toBe(0);
    });

    it('User B cannot see User A marks or semesters', async () => {
      const res = await request(app)
        .get('/api/marks/cgpa-semester')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.totalSemesters).toBe(0);
      expect(res.body.sgpaList).toHaveLength(0);
    });

    it('User B cannot see User A AI notes', async () => {
      const res = await request(app)
        .get('/api/ai/notes')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.notes).toHaveLength(0);
    });
  });

  // ── 3. API Response Contract Compatibility ──────────────────────────────
  describe('API Response Contract Compatibility', () => {
    it('GET /api/attendance/summary returns full contract structure', async () => {
      const res = await request(app)
        .get('/api/attendance/summary')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('overview');

      const s = res.body.summary[0];
      expect(s).toHaveProperty('subject', 'Computer Architecture');
      expect(s).toHaveProperty('code', 'CS201');
      expect(s).toHaveProperty('credits', 4);
      expect(s).toHaveProperty('total', 1);
      expect(s).toHaveProperty('present', 1);
      expect(s).toHaveProperty('percentage', 100);
      expect(s).toHaveProperty('status', 'safe');
      expect(s).toHaveProperty('neededClasses', 0);
      expect(s).toHaveProperty('missPredict');
      expect(s).toHaveProperty('currentStreak', 1);
    });

    it('GET /api/marks/cgpa-semester returns full contract structure', async () => {
      const res = await request(app)
        .get('/api/marks/cgpa-semester')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('cgpa');
      expect(res.body).toHaveProperty('sgpaList');
      expect(res.body).toHaveProperty('totalSemesters', 1);
      expect(res.body.sgpaList[0]).toHaveProperty('semester', 'Sem 1');
      expect(res.body.sgpaList[0]).toHaveProperty('sgpa');
    });

    it('GET /api/timetable returns full contract structure', async () => {
      const res = await request(app)
        .get('/api/timetable')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('subjects');
      expect(Array.isArray(res.body.subjects)).toBe(true);
      expect(res.body.subjects[0]).toHaveProperty('name', 'Computer Architecture');
    });

    it('GET /api/decision/today-plan returns full contract structure', async () => {
      const res = await request(app)
        .get('/api/decision/today-plan')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('todayPlan');
      expect(res.body).toHaveProperty('riskLevel');
      expect(res.body).toHaveProperty('focusArea');
      expect(Array.isArray(res.body.todayPlan)).toBe(true);
    });

    it('GET /api/ai/notes returns full contract structure', async () => {
      const res = await request(app)
        .get('/api/ai/notes')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('notes');
      expect(Array.isArray(res.body.notes)).toBe(true);
      expect(res.body.notes[0]).toHaveProperty('_id', 'Architecture_Notes.pdf');
      expect(res.body.notes[0]).toHaveProperty('chunks', 1);
      expect(res.body.notes[0]).toHaveProperty('updatedAt');
    });
  });
});
