// server/scripts/seedDemoAccount.js
//
// Seeds (or re-seeds) a single public-facing demo account with realistic
// academic history so the live demo isn't an empty signup screen. Safe to
// re-run: wipes only documents scoped to the demo user's own userId first.
//
// Usage: npm run seed:demo   (from /server)

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const User                = require('../models/User');
const Subject             = require('../models/Subject');
const Attendance          = require('../models/Attendance');
const Marks               = require('../models/Marks');
const Semester            = require('../models/Semester.model');
const CareerProgress      = require('../models/CareerProgress');
const Task                = require('../models/Task');
const ClassroomCourse     = require('../models/ClassroomCourse');
const ClassroomAssignment = require('../models/ClassroomAssignment');

const DEMO_EMAIL    = 'demo@studentai.app';
const DEMO_PASSWORD = 'Demo@123';

const DAY_MS = 24 * 60 * 60 * 1000;

// Walk backwards from today, `weeks` weeks, landing on the given weekday
// (0=Sun..6=Sat) each week, returning oldest-first dates.
function weeklyDates(weekday, weeks) {
  const dates = [];
  const today = new Date();
  today.setHours(9, 0, 0, 0);
  const diffToWeekday = (today.getDay() - weekday + 7) % 7;
  const mostRecent = new Date(today.getTime() - diffToWeekday * DAY_MS);
  for (let i = weeks - 1; i >= 0; i--) {
    dates.push(new Date(mostRecent.getTime() - i * 7 * DAY_MS));
  }
  return dates;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Subjects for the current (in-progress) semester — drive attendance + marks.
// Schedule is conflict-free: no two subjects share the same day+time slot.
//
// Weekly grid (24-hour, Mon–Fri):
//   09:00–10:00  DBMS(Mon), SE(Tue), SC(Wed), MATHS(Thu)
//   10:00–11:00  TOC(Mon),  MATHS(Tue)
//   11:00–12:00  DBMS(Thu), SE(Fri)
//   14:00–15:00  TOC(Wed),  SC(Fri)
const CURRENT_SUBJECTS = [
  {
    name: 'DBMS',
    code: 'DBMS',
    credits: 4,
    instructor: 'Dr. Priya Sharma',
    slots: [
      { day: 'Mon', startTime: '09:00', endTime: '10:00', room: 'LH-101' },
      { day: 'Thu', startTime: '11:00', endTime: '12:00', room: 'LH-101' },
    ],
    attendRate: 0.85,
  },
  {
    name: 'Software Engineering',
    code: 'SE',
    credits: 4,
    instructor: 'Prof. Ashpreet Kaur',
    slots: [
      { day: 'Tue', startTime: '09:00', endTime: '10:00', room: 'LH-202' },
      { day: 'Fri', startTime: '11:00', endTime: '12:00', room: 'LH-202' },
    ],
    attendRate: 0.85,
  },
  {
    // Deliberately low attendance — triggers shortage warning in the UI
    name: 'Theory of Computation',
    code: 'TOC',
    credits: 4,
    instructor: 'Dr. Rajesh Verma',
    slots: [
      { day: 'Mon', startTime: '10:00', endTime: '11:00', room: 'LH-103' },
      { day: 'Wed', startTime: '14:00', endTime: '15:00', room: 'LH-103' },
    ],
    attendRate: 0.65,
  },
  {
    name: 'Soft Computing',
    code: 'SC',
    credits: 3,
    instructor: 'Dr. Neha Gupta',
    slots: [
      { day: 'Wed', startTime: '09:00', endTime: '10:00', room: 'LH-204' },
      { day: 'Fri', startTime: '14:00', endTime: '15:00', room: 'LH-204' },
    ],
    attendRate: 0.82,
  },
  {
    name: 'Mathematics',
    code: 'MATHS',
    credits: 4,
    instructor: 'Prof. Sunil Arora',
    slots: [
      { day: 'Tue', startTime: '10:00', endTime: '11:00', room: 'LH-105' },
      { day: 'Thu', startTime: '09:00', endTime: '10:00', room: 'LH-105' },
    ],
    attendRate: 0.88,
  },
];

const WEEKS_OF_HISTORY = 10;

// Completed semesters — subjects arrays let Semester.pre('save') compute
// real SGPA via calculateSGPA(), same as the app itself would.
const COMPLETED_SEMESTERS = [
  {
    semesterNumber: 1,
    semesterName: 'Semester 1',
    subjects: [
      { name: 'Programming Fundamentals',  credits: 4, grade: 'A+' },
      { name: 'Engineering Mathematics I', credits: 4, grade: 'A'  },
      { name: 'Digital Logic Design',      credits: 3, grade: 'B+' },
      { name: 'Engineering Physics',       credits: 3, grade: 'A'  },
      { name: 'Communication Skills',      credits: 2, grade: 'A+' },
    ],
  },
  {
    semesterNumber: 2,
    semesterName: 'Semester 2',
    subjects: [
      { name: 'Data Structures',            credits: 4, grade: 'A'  },
      { name: 'Engineering Mathematics II', credits: 4, grade: 'B+' },
      { name: 'Object Oriented Programming', credits: 4, grade: 'A+' },
      { name: 'Digital Electronics',        credits: 3, grade: 'B'  },
      { name: 'Environmental Science',      credits: 2, grade: 'A'  },
    ],
  },
];

async function wipeExistingDemoData(userId) {
  await Promise.all([
    Subject.deleteMany({ userId }),
    Attendance.deleteMany({ userId }),
    Marks.deleteMany({ userId }),
    Semester.deleteMany({ student: userId }),
    CareerProgress.deleteMany({ userId }),
    Task.deleteMany({ user: userId }),
    ClassroomCourse.deleteMany({ userId }),
    ClassroomAssignment.deleteMany({ userId }),
  ]);
}

async function seedSubjectsAttendanceAndMarks(userId) {
  const subjectDocs = [];

  for (const spec of CURRENT_SUBJECTS) {
    const subject = await Subject.create({
      userId,
      name: spec.name,
      code: spec.code,
      credits: spec.credits,
      instructor: spec.instructor || '',
      schedule: spec.slots,
    });
    subjectDocs.push({ subject, spec });

    // ── Attendance history ──────────────────────────────────────────────
    // Use the numeric weekday from each slot's day name
    const dayNumMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    for (const slot of spec.slots) {
      const weekday = dayNumMap[slot.day];
      const dates = weeklyDates(weekday, WEEKS_OF_HISTORY);
      for (const date of dates) {
        const present = Math.random() < spec.attendRate;
        await Attendance.create({
          userId,
          subjectId: subject._id,
          date,
          status: present ? 'present' : 'absent',
          slot: slot.day,
          time: slot.startTime,
        });
      }
    }

    // ── Marks (midterm / quiz / assignment / final) ─────────────────────
    // Scores loosely track the subject's intended standing — TOC (the
    // deliberately weak subject) also scores lower here for consistency.
    const strong = spec.attendRate >= 0.82;
    const bands = strong
      ? { midterm: [78, 92], quiz: [16, 20], assignment: [21, 25], final: [80, 94] }
      : { midterm: [58, 72], quiz: [11, 16], assignment: [16, 21], final: [60, 74] };

    const rand = ([lo, hi]) => Math.floor(lo + Math.random() * (hi - lo));
    const examDate = (daysAgo) => new Date(Date.now() - daysAgo * DAY_MS);

    await Marks.create({ userId, subjectId: subject._id, examType: 'midterm',    marksObtained: rand(bands.midterm),    maxMarks: 100, examDate: examDate(60) });
    await Marks.create({ userId, subjectId: subject._id, examType: 'quiz',       marksObtained: rand(bands.quiz),       maxMarks: 20,  examDate: examDate(45) });
    await Marks.create({ userId, subjectId: subject._id, examType: 'assignment', marksObtained: rand(bands.assignment), maxMarks: 25,  examDate: examDate(30) });
    await Marks.create({ userId, subjectId: subject._id, examType: 'final',      marksObtained: rand(bands.final),      maxMarks: 100, examDate: examDate(10) });
  }

  return subjectDocs;
}

async function seedSemesters(userId) {
  for (const sem of COMPLETED_SEMESTERS) {
    await Semester.create({
      student: userId,
      semesterNumber: sem.semesterNumber,
      semesterName: sem.semesterName,
      subjects: sem.subjects,
      isManual: false,
    });
  }
}

async function seedCareerProgress(userId) {
  await CareerProgress.create({
    userId,
    targetCompany: 'Apple',
    targetRole: 'Software Engineer',
    problemsSolved: 70,
    leetcodeUsername: 'demo_student',
    leetcodeSync: {
      lastSyncAt: new Date(),
      totalOnLeetcode: 70,
      easy: 38,
      medium: 27,
      hard: 5,
      solvedCount: 70,
      topicCounts: {
        Array: 18, String: 12, 'Dynamic Programming': 8, Tree: 7,
        Graph: 5, 'Hash Table': 9, 'Two Pointers': 6, Stack: 5,
      },
    },
    readiness: 'Intermediate',
    dsaTopics: [
      { name: 'Arrays & Strings',    completed: true,  problems: 30 },
      { name: 'Hashing',             completed: true,  problems: 9  },
      { name: 'Dynamic Programming', completed: false, problems: 8  },
      { name: 'Graphs',              completed: false, problems: 5  },
      { name: 'Trees',               completed: true,  problems: 7  },
    ],
    skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Data Structures & Algorithms'],
    resumeScore: 74,
    resumeFeedback: [
      'Quantify project impact with metrics (users, latency, % improvement)',
      'Add a dedicated Skills section matching target job description keywords',
    ],
    resumeKeywords: ['REST API', 'MongoDB', 'React', 'System Design'],
    resumeStrengths: ['Strong project section', 'Clear formatting'],
    resumeAtsRisk: 'low',
    mockInterviews: [
      { topic: 'Arrays', question: 'Find the maximum subarray sum (Kadane\'s Algorithm).', userAnswer: 'Track running sum, reset when negative, keep max seen.', score: 8, feedback: 'Correct approach, explain time complexity next time.', modelAnswer: 'O(n) single pass using Kadane\'s algorithm.', createdAt: new Date(Date.now() - 12 * DAY_MS) },
      { topic: 'System Design', question: 'How would you design a URL shortener?', userAnswer: 'Hash the URL, store mapping in a key-value store, use base62 encoding for short codes.', score: 7, feedback: 'Good fundamentals — discuss scaling and collision handling further.', modelAnswer: 'Base62 encode an auto-incrementing ID, cache hot redirects, shard by key.', createdAt: new Date(Date.now() - 5 * DAY_MS) },
    ],
    dsaSessions: [
      { date: new Date(Date.now() - 8 * DAY_MS), note: 'Focused on DP patterns', problemsAdded: 4, topics: ['Dynamic Programming'], aiFeedback: 'Good progress on 1D DP — try 2D grid problems next.' },
      { date: new Date(Date.now() - 2 * DAY_MS), note: 'Graph traversal practice', problemsAdded: 3, topics: ['Graphs'], aiFeedback: 'Solid grasp of BFS/DFS — move on to weighted graphs.' },
    ],
  });
}

async function seedClassroomData(userId) {
  const inDays = (n) => new Date(Date.now() + n * DAY_MS);

  // ── Classroom courses (mirror the timetable subjects) ──────────────────
  const COURSES = [
    { courseId: 'demo-course-dbms',  courseName: 'DBMS',                  teacherName: 'Dr. Priya Sharma',   section: 'CSE-3 G1', room: 'LH-101' },
    { courseId: 'demo-course-se',    courseName: 'Software Engineering',   teacherName: 'Prof. Ashpreet Kaur', section: 'CSE-3 G1', room: 'LH-202' },
    { courseId: 'demo-course-toc',   courseName: 'Theory of Computation',  teacherName: 'Dr. Rajesh Verma',   section: 'CSE-3 G1', room: 'LH-103' },
    { courseId: 'demo-course-sc',    courseName: 'Soft Computing',         teacherName: 'Dr. Neha Gupta',     section: 'CSE-3 G1', room: 'LH-204' },
    { courseId: 'demo-course-maths', courseName: 'Mathematics',            teacherName: 'Prof. Sunil Arora',  section: 'CSE-3 G1', room: 'LH-105' },
  ];

  for (const c of COURSES) {
    await ClassroomCourse.create({ userId, ...c });
  }

  // ── Assignments per course ─────────────────────────────────────────────
  const ASSIGNMENTS = [
    // DBMS
    {
      courseId: 'demo-course-dbms', courseName: 'DBMS',
      assignmentId: 'demo-dbms-a1', title: 'ER Diagram — Library Management System',
      description: 'Design a complete ER diagram for a library management system with entity, relationship, and cardinality annotations.',
      dueDate: inDays(4), dueTime: '23:59', status: 'assigned', maxPoints: 25, estimatedHours: 3, priority: 'HIGH',
    },
    {
      courseId: 'demo-course-dbms', courseName: 'DBMS',
      assignmentId: 'demo-dbms-a2', title: 'SQL Lab — Advanced Joins & Subqueries',
      description: 'Complete the SQL exercises on INNER/OUTER joins, correlated subqueries, and window functions.',
      dueDate: inDays(10), dueTime: '23:59', status: 'assigned', maxPoints: 20, estimatedHours: 2, priority: 'MEDIUM',
    },
    {
      courseId: 'demo-course-dbms', courseName: 'DBMS',
      assignmentId: 'demo-dbms-a3', title: 'Normalization Assignment (1NF → BCNF)',
      description: 'Normalize the given unnormalized relation step-by-step up to BCNF. Show all functional dependencies.',
      dueDate: inDays(-2), dueTime: '23:59', status: 'submitted', maxPoints: 30, estimatedHours: 4, priority: 'LOW',
    },

    // Software Engineering
    {
      courseId: 'demo-course-se', courseName: 'Software Engineering',
      assignmentId: 'demo-se-a1', title: 'Project Demo — Sprint 2 Review',
      description: 'Present your Sprint 2 deliverables with a working demo, burn-down chart, and retrospective notes.',
      dueDate: inDays(6), dueTime: '17:00', status: 'assigned', maxPoints: 50, estimatedHours: 5, priority: 'CRITICAL',
    },
    {
      courseId: 'demo-course-se', courseName: 'Software Engineering',
      assignmentId: 'demo-se-a2', title: 'SRS Document — Version 1.1',
      description: 'Update your Software Requirements Specification to include use-case diagrams and non-functional requirements.',
      dueDate: inDays(14), dueTime: '23:59', status: 'assigned', maxPoints: 40, estimatedHours: 4, priority: 'MEDIUM',
    },

    // Theory of Computation
    {
      courseId: 'demo-course-toc', courseName: 'Theory of Computation',
      assignmentId: 'demo-toc-a1', title: 'DFA Construction — Problem Set 3',
      description: 'Construct minimal DFAs for each of the 8 regular languages described. Justify minimality.',
      dueDate: inDays(2), dueTime: '23:59', status: 'assigned', maxPoints: 20, estimatedHours: 3, priority: 'HIGH',
    },
    {
      courseId: 'demo-course-toc', courseName: 'Theory of Computation',
      assignmentId: 'demo-toc-a2', title: 'CFG → PDA Conversion',
      description: 'Convert the given context-free grammars to equivalent push-down automata.',
      dueDate: inDays(9), dueTime: '23:59', status: 'assigned', maxPoints: 25, estimatedHours: 3, priority: 'MEDIUM',
    },

    // Soft Computing
    {
      courseId: 'demo-course-sc', courseName: 'Soft Computing',
      assignmentId: 'demo-sc-a1', title: 'Fuzzy Logic Quiz Prep Sheet',
      description: 'Summarise membership functions, fuzzy operations, and defuzzification methods on a single A4 sheet.',
      dueDate: inDays(9), dueTime: '23:59', status: 'assigned', maxPoints: 15, estimatedHours: 2, priority: 'MEDIUM',
    },
    {
      courseId: 'demo-course-sc', courseName: 'Soft Computing',
      assignmentId: 'demo-sc-a2', title: 'Neural Network Lab — Backpropagation',
      description: 'Implement a two-layer MLP from scratch in Python. Train on the XOR dataset and report accuracy.',
      dueDate: inDays(18), dueTime: '23:59', status: 'assigned', maxPoints: 30, estimatedHours: 4, priority: 'LOW',
    },

    // Mathematics
    {
      courseId: 'demo-course-maths', courseName: 'Mathematics',
      assignmentId: 'demo-maths-a1', title: 'Linear Algebra — Eigenvalue Problem Set',
      description: 'Solve problems on eigenvalues, eigenvectors, diagonalisation, and applications to differential equations.',
      dueDate: inDays(5), dueTime: '23:59', status: 'assigned', maxPoints: 20, estimatedHours: 2, priority: 'HIGH',
    },
    {
      courseId: 'demo-course-maths', courseName: 'Mathematics',
      assignmentId: 'demo-maths-a2', title: 'Probability & Statistics Quiz',
      description: 'Online quiz covering Bayes theorem, probability distributions, expectation and variance.',
      dueDate: inDays(-5), dueTime: '23:59', status: 'returned', maxPoints: 20, estimatedHours: 1, priority: 'LOW',
    },
  ];

  for (const a of ASSIGNMENTS) {
    await ClassroomAssignment.create({ userId, ...a });
  }
}

async function seedTasks(userId) {
  const inDays = (n) => new Date(Date.now() + n * DAY_MS);
  await Task.insertMany([
    { user: userId, title: 'DBMS Assignment 3 — Normalization', subject: 'DBMS', dueDate: inDays(3), priority: 'high', status: 'pending', type: 'assignment' },
    { user: userId, title: 'Software Engineering project demo', subject: 'Software Engineering', dueDate: inDays(6), priority: 'critical', status: 'in-progress', type: 'project' },
    { user: userId, title: 'TOC mid-sem revision', subject: 'Theory of Computation', dueDate: inDays(2), priority: 'high', status: 'pending', type: 'revision' },
    { user: userId, title: 'Soft Computing quiz prep', subject: 'Soft Computing', dueDate: inDays(9), priority: 'medium', status: 'pending', type: 'exam' },
    { user: userId, title: 'LeetCode: 3 DP problems', subject: 'General', dueDate: inDays(1), priority: 'medium', status: 'pending', type: 'other' },
  ]);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[seed:demo] Connected to MongoDB');

  let user = await User.findOne({ email: DEMO_EMAIL });
  const hashed = await bcrypt.hash(DEMO_PASSWORD, 12);

  if (user) {
    console.log('[seed:demo] Demo user already exists — wiping child documents and resetting profile');
    user.password = hashed;
    user.name = 'Demo Student';
    user.role = 'student';
    user.college = 'PEC';
    user.branch = 'CSE';
    user.semester = 3;
    user.sid = 'DEMO2024';
    user.cgpa = 0;
    await user.save();
    await wipeExistingDemoData(user._id);
  } else {
    user = await User.create({
      name: 'Demo Student',
      email: DEMO_EMAIL,
      password: hashed,
      role: 'student',
      college: 'PEC',
      branch: 'CSE',
      semester: 3,
      sid: 'DEMO2024',
    });
    console.log('[seed:demo] Created new demo user');
  }

  await seedSubjectsAttendanceAndMarks(user._id);
  await seedSemesters(user._id);
  await seedCareerProgress(user._id);
  await seedClassroomData(user._id);
  await seedTasks(user._id);

  console.log('[seed:demo] Done. Login with:');
  console.log(`[seed:demo]   email:    ${DEMO_EMAIL}`);
  console.log(`[seed:demo]   password: ${DEMO_PASSWORD}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed:demo] FAILED:', err);
  process.exit(1);
});
