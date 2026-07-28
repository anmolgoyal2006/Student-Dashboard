const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const User    = require('../models/User');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');

describe('Manual Attendance Balance & Retroactive Marking', () => {
  let user, token, subject;

  beforeEach(async () => {
    // Clean up
    await User.deleteMany({});
    await Subject.deleteMany({});
    await Attendance.deleteMany({});

    user = await User.create({
      name: 'Test Student',
      email: 'student@example.com',
      password: 'password123',
      role: 'student',
      sid: 'S101'
    });

    token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    subject = await Subject.create({
      userId: user._id,
      name: 'Computer Networks',
      code: 'CSN302',
      credits: 4,
      instructor: 'Dr. Jones',
      schedule: [
        { day: 'Mon', startTime: '09:00', endTime: '10:00', room: 'L20' }
      ]
    });
  });

  describe('Subject initial balance offsets', () => {
    test('updates initialPresent and initialTotal with PUT /api/timetable/:id', async () => {
      const res = await request(app)
        .put(`/api/timetable/${subject._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          initialTotal: 10,
          initialPresent: 8
        });

      expect(res.status).toBe(200);
      expect(res.body.subject.initialTotal).toBe(10);
      expect(res.body.subject.initialPresent).toBe(8);

      const updated = await Subject.findById(subject._id);
      expect(updated.initialTotal).toBe(10);
      expect(updated.initialPresent).toBe(8);
    });

    test('rejects update if initialPresent exceeds initialTotal', async () => {
      const res = await request(app)
        .put(`/api/timetable/${subject._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          initialTotal: 10,
          initialPresent: 12
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('attended cannot exceed total');
    });
  });

  describe('Attendance summary calculations with initial offsets', () => {
    beforeEach(async () => {
      // Set initial balance
      subject.initialTotal = 15;
      subject.initialPresent = 12;
      await subject.save();

      // Mark 1 present and 1 absent in database records
      await Attendance.create([
        { userId: user._id, subjectId: subject._id, date: new Date('2026-07-20'), status: 'present', slot: 'slot_0' },
        { userId: user._id, subjectId: subject._id, date: new Date('2026-07-27'), status: 'absent', slot: 'slot_0' }
      ]);
    });

    test('getAttendanceSummary aggregates initial balances + logged records', async () => {
      const res = await request(app)
        .get('/api/attendance/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const subSummary = res.body.summary.find(s => s.code === 'CSN302');
      expect(subSummary).toBeDefined();
      
      // initialTotal (15) + records (2) = 17 total classes
      expect(subSummary.total).toBe(17);
      // initialPresent (12) + records (1 present) = 13 present classes
      expect(subSummary.present).toBe(13);
      // percentage = 13 / 17 * 100 = 76.5%
      expect(subSummary.percentage).toBe(76.5);
    });

    test('getStudentBySid aggregates initial balances + logged records', async () => {
      const res = await request(app)
        .get(`/api/attendance/student/${user.sid}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const subSummary = res.body.summary.find(s => s.code === 'CSN302');
      expect(subSummary).toBeDefined();

      // initialTotal (15) + records (2) = 17 total classes
      expect(subSummary.total).toBe(17);
      expect(subSummary.present).toBe(13);
      expect(subSummary.percentage).toBe(76);
      
      expect(res.body.total).toBe(17);
      expect(res.body.present).toBe(13);
      expect(res.body.absent).toBe(4);
    });
  });

  describe('Retroactive marking deletion / unmarking', () => {
    beforeEach(async () => {
      await Attendance.create({
        userId: user._id,
        subjectId: subject._id,
        date: new Date('2026-07-20'),
        status: 'present',
        slot: 'slot_0'
      });
    });

    test('deletes attendance record with DELETE /api/attendance', async () => {
      // Check record exists
      let record = await Attendance.findOne({ userId: user._id, subjectId: subject._id });
      expect(record).not.toBeNull();

      const res = await request(app)
        .delete('/api/attendance')
        .set('Authorization', `Bearer ${token}`)
        .send({
          subjectId: subject._id.toString(),
          date: '2026-07-20',
          slot: 'slot_0'
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Attendance record deleted');

      // Verify deletion
      record = await Attendance.findOne({ userId: user._id, subjectId: subject._id });
      expect(record).toBeNull();
    });
  });
});
