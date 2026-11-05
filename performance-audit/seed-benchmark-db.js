// performance-audit/seed-benchmark-db.js
// Seeds a dedicated, isolated local MongoDB database ('student-benchmark')
// with realistic academic history, subjects, attendance, marks, semesters,
// career progress, classroom data, and note chunks with vector embeddings.

const path = require('path');
module.paths.push(path.join(__dirname, '../server/node_modules'));

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

const User                = require('../server/models/User');
const Subject             = require('../server/models/Subject');
const Attendance          = require('../server/models/Attendance');
const Marks               = require('../server/models/Marks');
const Semester            = require('../server/models/Semester.model');
const CareerProgress      = require('../server/models/CareerProgress');
const Task                = require('../server/models/Task');
const ClassroomCourse     = require('../server/models/ClassroomCourse');
const ClassroomAssignment = require('../server/models/ClassroomAssignment');
const NoteChunk           = require('../server/models/NoteChunk');
const Notification        = require('../server/models/Notification');

const MONGO_BENCHMARK_URI = process.env.MONGO_BENCHMARK_URI || 'mongodb://127.0.0.1:27017/student-benchmark';
const JWT_SECRET = process.env.JWT_SECRET || 'benchmark-super-secret-key-2026';

const BENCHMARK_USER = {
  name: 'Benchmark Student',
  email: 'benchmark@studentai.local',
  password: 'Password@123',
  sid: 'BENCH2026',
  role: 'student',
  semester: 4,
  branch: 'Computer Science',
  college: 'National Institute of Technology',
  tokenVersion: 1,
};

// Generates a mock 768-dimensional float embedding normalized to unit length
function generateMockVector(dim = 768) {
  const vec = new Float32Array(dim);
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    vec[i] = (Math.random() - 0.5) * 2;
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm) || 1;
  const result = new Array(dim);
  for (let i = 0; i < dim; i++) {
    result[i] = +(vec[i] / norm).toFixed(6);
  }
  return result;
}

async function seed() {
  console.log(`[Seed] Connecting to ${MONGO_BENCHMARK_URI}...`);
  await mongoose.connect(MONGO_BENCHMARK_URI);
  console.log('[Seed] Connected.');

  // Drop existing benchmark database clean
  await mongoose.connection.dropDatabase();
  console.log('[Seed] Dropped previous benchmark database.');

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(BENCHMARK_USER.password, salt);

  // 1. Create primary benchmark user
  const user = await User.create({
    ...BENCHMARK_USER,
    password: passwordHash,
  });

  // Also create 10 background users to simulate multi-tenant collection density
  const otherUsers = [];
  for (let i = 1; i <= 10; i++) {
    const u = await User.create({
      name: `Student ${i}`,
      email: `student${i}@test.local`,
      password: passwordHash,
      sid: `SID2026_${i}`,
      semester: (i % 8) + 1,
      tokenVersion: 1,
    });
    otherUsers.push(u);
  }
  console.log('[Seed] Users created (1 primary benchmark user + 10 background users).');

  // 2. Create Subjects for benchmark user
  const subjectSpecs = [
    { name: 'Database Management Systems', code: 'CS301', credits: 4, instructor: 'Dr. Priya Sharma' },
    { name: 'Software Engineering', code: 'CS302', credits: 4, instructor: 'Prof. Ashpreet Kaur' },
    { name: 'Theory of Computation', code: 'CS303', credits: 4, instructor: 'Dr. Rajesh Verma' },
    { name: 'Design and Analysis of Algorithms', code: 'CS304', credits: 4, instructor: 'Prof. Sunil Arora' },
    { name: 'Computer Networks', code: 'CS305', credits: 3, instructor: 'Dr. Neha Gupta' },
    { name: 'Cloud Computing & DevOps', code: 'CS306', credits: 3, instructor: 'Prof. Vikram Sen' },
  ];

  const subjects = [];
  for (const spec of subjectSpecs) {
    const s = await Subject.create({
      userId: user._id,
      name: spec.name,
      code: spec.code,
      credits: spec.credits,
      instructor: spec.instructor,
      initialPresent: 18,
      initialTotal: 20,
      schedule: [
        { day: 'Mon', startTime: '09:00', endTime: '10:00', room: 'LH-101' },
        { day: 'Wed', startTime: '11:00', endTime: '12:00', room: 'LH-101' },
        { day: 'Fri', startTime: '14:00', endTime: '15:00', room: 'LH-101' },
      ],
    });
    subjects.push(s);
  }

  // Also create subjects for other users
  for (const u of otherUsers) {
    await Subject.create({
      userId: u._id,
      name: 'General Engineering',
      code: 'GEN101',
      credits: 3,
      schedule: [{ day: 'Mon', startTime: '10:00', endTime: '11:00' }],
    });
  }
  console.log(`[Seed] Created ${subjects.length} subjects for benchmark user.`);

  // 3. Create Attendance records (120 records spanning 15 weeks)
  const attendanceDocs = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (const subject of subjects) {
    for (let dayOffset = 1; dayOffset <= 20; dayOffset++) {
      const recordDate = new Date(now - dayOffset * 2 * dayMs);
      recordDate.setUTCHours(12, 0, 0, 0);
      const isPresent = Math.random() > 0.15; // 85% attendance
      attendanceDocs.push({
        userId: user._id,
        subjectId: subject._id,
        date: recordDate,
        status: isPresent ? 'present' : 'absent',
        slot: 'Mon',
        time: '09:00',
      });
    }
  }
  // Add records for background users
  for (const u of otherUsers) {
    for (let d = 1; d <= 10; d++) {
      attendanceDocs.push({
        userId: u._id,
        subjectId: subjects[0]._id,
        date: new Date(now - d * dayMs),
        status: 'present',
        slot: 'Tue',
        time: '10:00',
      });
    }
  }
  await Attendance.insertMany(attendanceDocs);
  console.log(`[Seed] Created ${attendanceDocs.length} attendance records.`);

  // 4. Create Marks and Semesters
  const marksDocs = [];
  for (const subject of subjects) {
    marksDocs.push(
      {
        userId: user._id,
        subjectId: subject._id,
        examType: 'midterm',
        marksObtained: 42,
        maxMarks: 50,
        gradePoint: 9,
        examDate: new Date(now - 30 * dayMs),
      },
      {
        userId: user._id,
        subjectId: subject._id,
        examType: 'final',
        marksObtained: 85,
        maxMarks: 100,
        gradePoint: 9,
        examDate: new Date(now - 10 * dayMs),
      }
    );
  }
  await Marks.insertMany(marksDocs);

  // 3 completed semesters
  await Semester.create([
    {
      student: user._id,
      semesterNumber: 1,
      semesterName: 'Semester 1',
      isManual: false,
      subjects: [
        { name: 'Mathematics I', credits: 4, grade: 'A+' },
        { name: 'Physics', credits: 4, grade: 'A' },
        { name: 'Basic Electrical Eng', credits: 3, grade: 'B+' },
        { name: 'Engineering Graphics', credits: 3, grade: 'A' },
      ],
    },
    {
      student: user._id,
      semesterNumber: 2,
      semesterName: 'Semester 2',
      isManual: false,
      subjects: [
        { name: 'Mathematics II', credits: 4, grade: 'A' },
        { name: 'Programming in C', credits: 4, grade: 'A+' },
        { name: 'Digital Electronics', credits: 3, grade: 'A' },
        { name: 'Environmental Science', credits: 2, grade: 'B+' },
      ],
    },
    {
      student: user._id,
      semesterNumber: 3,
      semesterName: 'Semester 3',
      isManual: false,
      subjects: [
        { name: 'Data Structures', credits: 4, grade: 'A+' },
        { name: 'Discrete Mathematics', credits: 4, grade: 'A' },
        { name: 'Computer Architecture', credits: 4, grade: 'B+' },
        { name: 'Object Oriented Programming', credits: 3, grade: 'A+' },
      ],
    },
  ]);
  console.log('[Seed] Created marks and 3 completed semesters.');

  // 5. Create Career Progress & Classroom Assignments
  await CareerProgress.create({
    userId: user._id,
    targetCompany: 'Google',
    targetRole: 'Software Engineer',
    problemsSolved: 142,
    leetcodeUsername: 'bench_student',
    readiness: 'Intermediate',
    leetcodeSync: {
      easy: 60,
      medium: 70,
      hard: 12,
      totalOnLeetcode: 142,
    },
  });

  await ClassroomAssignment.create([
    {
      userId: user._id,
      courseId: 'CR_CS301',
      courseName: 'Database Management Systems',
      assignmentId: 'ASSIGN_1',
      title: 'B+ Tree Indexing Implementation',
      dueDate: new Date(now + 2 * dayMs),
      status: 'assigned',
      priority: 'HIGH',
    },
    {
      userId: user._id,
      courseId: 'CR_CS304',
      courseName: 'Design and Analysis of Algorithms',
      assignmentId: 'ASSIGN_2',
      title: 'Dynamic Programming Problem Set 3',
      dueDate: new Date(now + 5 * dayMs),
      status: 'assigned',
      priority: 'MEDIUM',
    },
  ]);

  // 6. Create NoteChunks with vector embeddings (50 chunks for benchmark user, 100 for background users)
  const noteDocs = [];
  const sampleTopics = [
    'Database Normalization and BCNF Rules',
    'ACID Properties and Two-Phase Locking',
    'Dijkstra and A* Shortest Path Algorithms',
    'Operating System Deadlocks and Banker Algorithm',
    'TCP Three-Way Handshake and Congestion Control',
  ];

  for (let fileIdx = 0; fileIdx < sampleTopics.length; fileIdx++) {
    const filename = `${sampleTopics[fileIdx].replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    for (let c = 0; c < 10; c++) {
      noteDocs.push({
        user: user._id,
        filename,
        chunkIndex: c,
        text: `Detailed technical notes for ${sampleTopics[fileIdx]} chunk ${c}. Covers concurrency, query optimization, indexing strategies, and relational algebra formulations.`,
        embedding: generateMockVector(768),
      });
    }
  }

  // Background note chunks
  for (const u of otherUsers) {
    for (let c = 0; c < 10; c++) {
      noteDocs.push({
        user: u._id,
        filename: 'Background_Notes.pdf',
        chunkIndex: c,
        text: `Background notes for student ${u._id} chunk ${c}.`,
        embedding: generateMockVector(768),
      });
    }
  }

  await NoteChunk.insertMany(noteDocs);
  console.log(`[Seed] Created ${noteDocs.length} NoteChunk documents with 768-dim embeddings.`);

  // 7. Mint valid JWT for benchmark execution
  const token = jwt.sign(
    {
      id: user._id,
      _id: user._id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  console.log('\n======================================================');
  console.log('✅ BENCHMARK DATABASE SEEDING COMPLETE');
  console.log('------------------------------------------------------');
  console.log(`Target DB:      ${MONGO_BENCHMARK_URI}`);
  console.log(`User ID:        ${user._id}`);
  console.log(`User Email:     ${user.email}`);
  console.log(`JWT Token:      ${token.slice(0, 20)}...${token.slice(-10)}`);
  console.log('======================================================\n');

  await mongoose.connection.close();
  return { userId: user._id, token, jwtSecret: JWT_SECRET };
}

if (require.main === module) {
  seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

module.exports = { seed, BENCHMARK_USER, JWT_SECRET, MONGO_BENCHMARK_URI };
