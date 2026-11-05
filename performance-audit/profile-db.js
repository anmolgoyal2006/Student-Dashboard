// performance-audit/profile-db.js
// Profiles MongoDB queries used by StudentAI endpoints using .explain('executionStats').

const path = require('path');
module.paths.push(path.join(__dirname, '../server/node_modules'));

const mongoose = require('mongoose');
const User                = require('../server/models/User');
const Subject             = require('../server/models/Subject');
const Attendance          = require('../server/models/Attendance');
const Marks               = require('../server/models/Marks');
const Semester            = require('../server/models/Semester.model');
const CareerProgress      = require('../server/models/CareerProgress');
const ClassroomAssignment = require('../server/models/ClassroomAssignment');
const NoteChunk           = require('../server/models/NoteChunk');

const MONGO_BENCHMARK_URI = process.env.MONGO_BENCHMARK_URI || 'mongodb://127.0.0.1:27017/student-benchmark';

function extractExecutionStats(explainResult) {
  const stats = explainResult.executionStats || {};
  const queryPlanner = explainResult.queryPlanner || {};
  const winningPlan = queryPlanner.winningPlan || {};

  // Recursively search for stages like COLLSCAN, IXSCAN, SORT
  function findStages(plan, acc = []) {
    if (!plan) return acc;
    if (plan.stage) acc.push(plan.stage);
    if (plan.inputStage) findStages(plan.inputStage, acc);
    if (plan.inputStages) plan.inputStages.forEach(s => findStages(s, acc));
    return acc;
  }

  const stages = findStages(winningPlan);

  return {
    executionTimeMillis: stats.executionTimeMillis,
    totalDocsExamined: stats.totalDocsExamined,
    totalKeysExamined: stats.totalKeysExamined,
    nReturned: stats.nReturned,
    stages,
    isCollscan: stages.includes('COLLSCAN'),
    hasInMemorySort: stages.includes('SORT'),
    winningPlanStage: winningPlan.stage,
    indexName: winningPlan.inputStage?.indexName || winningPlan.indexName || null,
  };
}

async function profileDatabase() {
  await mongoose.connect(MONGO_BENCHMARK_URI);
  const user = await User.findOne({ email: 'benchmark@studentai.local' });
  if (!user) {
    throw new Error('Benchmark user not found. Run seed-benchmark-db.js first.');
  }

  const userId = user._id;
  const since = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
  const results = {};

  console.log(`\n========================================================================`);
  console.log(`🔍 EXPLAIN EXECUTION STATS FOR TARGET QUERIES (User: ${userId})`);
  console.log(`========================================================================\n`);

  // 1. NoteChunk Vector Search Query (used by RAG)
  {
    const explain = await NoteChunk.find({ user: userId }).explain('executionStats');
    results.noteChunk_find = extractExecutionStats(explain);
  }

  // 2. NoteChunk Aggregation (used by GET /api/ai/notes)
  {
    const explain = await NoteChunk.aggregate([
      { $match: { user: userId } },
      { $group: {
          _id: '$filename',
          chunks: { $sum: 1 },
          updatedAt: { $max: '$updatedAt' },
      }},
      { $sort: { updatedAt: -1 } },
    ]).explain('executionStats');
    // Aggregate explain returns stages array
    const executionStats = explain[0]?.executionStats || explain.stages?.[0]?.executionStats || {};
    results.noteChunk_aggregate = {
      executionTimeMillis: executionStats.executionTimeMillis ?? explain[0]?.executionTimeMillis ?? 0,
      totalDocsExamined: executionStats.totalDocsExamined ?? 0,
      totalKeysExamined: executionStats.totalKeysExamined ?? 0,
      stages: ['AGGREGATE'],
      isCollscan: !explain[0]?.queryPlanner?.winningPlan?.inputStage?.indexName,
    };
  }

  // 3. Semester Query (used by GET /api/marks/cgpa-semester)
  {
    const explain = await Semester.find({ student: userId })
      .sort({ semesterNumber: 1 })
      .explain('executionStats');
    results.semester_sortBySemNumber = extractExecutionStats(explain);
  }

  // 4. Marks Query: final exams for CGPA (used by Dashboard & CGPA)
  {
    const explain = await Marks.find({ userId, examType: 'final' })
      .explain('executionStats');
    results.marks_finalExam = extractExecutionStats(explain);
  }

  // 5. Marks Query: all marks sorted by date (used by GET /api/marks)
  {
    const explain = await Marks.find({ userId })
      .sort({ examDate: -1 })
      .explain('executionStats');
    results.marks_sortByDate = extractExecutionStats(explain);
  }

  // 6. Attendance Query: all attendance sorted by date (used by GET /api/attendance/summary & Dashboard)
  {
    const explain = await Attendance.find({ userId })
      .sort({ date: 1 })
      .explain('executionStats');
    results.attendance_summary = extractExecutionStats(explain);
  }

  // 7. Attendance Query: monthly trends
  {
    const explain = await Attendance.find({
      userId,
      date: { $gte: since },
      status: { $ne: 'cancelled' },
    }).explain('executionStats');
    results.attendance_trends = extractExecutionStats(explain);
  }

  // 8. Timetable Query: subjects sorted by name (used by GET /api/timetable)
  {
    const explain = await Subject.find({ userId })
      .sort({ name: 1 })
      .explain('executionStats');
    results.subject_sortByName = extractExecutionStats(explain);
  }

  // 9. ClassroomAssignment Query (used by Dashboard Smart Plan)
  {
    const explain = await ClassroomAssignment.find({
      userId,
      status: { $ne: 'submitted' },
    }).sort({ dueDate: 1 }).explain('executionStats');
    results.classroomAssignment_dashboard = extractExecutionStats(explain);
  }

  console.table(Object.entries(results).map(([query, s]) => ({
    Query: query,
    TimeMS: s.executionTimeMillis,
    DocsExamined: s.totalDocsExamined,
    KeysExamined: s.totalKeysExamined,
    COLLSCAN: s.isCollscan ? '⚠️ YES' : 'NO',
    InMemorySort: s.hasInMemorySort ? '⚠️ YES' : 'NO',
    Stages: s.stages?.join(' -> ') || 'N/A',
  })));

  await mongoose.connection.close();
  return results;
}

if (require.main === module) {
  profileDatabase().catch(err => {
    console.error('Profiling error:', err);
    process.exit(1);
  });
}

module.exports = { profileDatabase };
