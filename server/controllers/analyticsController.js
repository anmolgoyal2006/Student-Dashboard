const ClassroomAssignment = require('../models/ClassroomAssignment');
const Task = require('../models/Task');
const Attendance = require('../models/Attendance');
const ClassroomCourse = require('../models/ClassroomCourse');

exports.getAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;

    // ── Fetch ClassroomAssignments, Tasks, and ClassroomCourses ──
    const [assignments, tasks, importedCourses] = await Promise.all([
      ClassroomAssignment.find({ userId }).lean(),
      Task.find({ user: userId }).lean(),
      ClassroomCourse.find({ userId }).lean(),
    ]);

    const hasImportedCourses = importedCourses.length > 0;
    const importedCourseNames = new Set(importedCourses.map(c => c.courseName.toLowerCase()));

    // Filter assignments and tasks to only show imported ones (if Classroom is used)
    const filteredAssignments = hasImportedCourses
      ? assignments.filter(a => a.courseName && importedCourseNames.has(a.courseName.toLowerCase()))
      : assignments;

    const filteredTasks = hasImportedCourses
      ? tasks.filter(t => t.subject && importedCourseNames.has(t.subject.toLowerCase()))
      : tasks;

    // Use Classroom data if available, otherwise fall back to Tasks
    const hasClassroom = filteredAssignments.length > 0;
    // Assignments without a due date can't contribute to completion rate,
    // overdue count, weekly trend, or deadline timeline — exclude them from
    // all metric calculations. They are still synced and stored, just not
    // shown in analytics where a date is required to be meaningful.
    const dataSource = hasClassroom
      ? filteredAssignments.filter(a => !!a.dueDate)
      : filteredTasks.filter(t => !!t.dueDate);

    // ── Assignment metrics ──
    const total = dataSource.length;
    const completed = dataSource.filter(a =>
      a.status === 'submitted' || a.status === 'returned' || a.status === 'completed'
    ).length;
    const overdue = dataSource.filter(a =>
      (a.status === 'assigned' || a.status === 'missing' || a.status === 'pending') &&
      a.dueDate && new Date(a.dueDate) < new Date()
    ).length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // ── Most demanding subject ──
    const subjectCounts = {};
    dataSource.forEach(a => {
      const name = a.courseName || a.subject;
      if (name && name !== 'Unknown' && name !== 'unknown') {
        subjectCounts[name] = (subjectCounts[name] || 0) + 1;
      }
    });
    const mostDemanding = Object.entries(subjectCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    // ── Average completion time ──
    const completedItems = dataSource.filter(a =>
      (a.status === 'submitted' || a.status === 'returned' || a.status === 'completed') && a.estimatedHours
    );
    const avgCompletionHours = completedItems.length > 0
      ? Math.round(completedItems.reduce((s, a) => s + (a.estimatedHours || 0), 0) / completedItems.length)
      : filteredTasks.length > 0
        ? Math.round(filteredTasks.filter(t => t.status === 'completed').length / Math.max(filteredTasks.length, 1) * 5)
        : 0;

    // ── Weekly completion trend (last 8 weeks) ──
    const weeklyData = [];
    for (let i = 0; i < 8; i++) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - (7 - i) * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekItems = dataSource.filter(a => {
        if (!a.dueDate) return false;
        const d = new Date(a.dueDate);
        return d >= weekStart && d < weekEnd;
      });
      const weekCompleted = weekItems.filter(a =>
        a.status === 'submitted' || a.status === 'returned' || a.status === 'completed'
      ).length;

      weeklyData.push({
        week: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        assigned: weekItems.length,
        completed: weekCompleted,
        start: weekStart.toISOString().slice(0, 10),
      });
    }

    // ── Subject workload distribution ──
    const workloadBySubject = Object.entries(subjectCounts)
      .map(([name, count]) => ({ subject: name, assignments: count }))
      .sort((a, b) => b.assignments - a.assignments);

    // ── Deadline distribution (next 4 weeks) ──
    const now = new Date();
    const deadlineData = [];
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() + ((7 - weekStart.getDay()) % 7) + i * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const count = dataSource.filter(a => {
        if (!a.dueDate || a.status === 'submitted' || a.status === 'returned' || a.status === 'completed') return false;
        const d = new Date(a.dueDate);
        return d >= weekStart && d < weekEnd;
      }).length;

      const labels = ['This Week', 'Next Week', 'In 2 Weeks', 'In 3 Weeks'];
      deadlineData.push({ week: labels[i] || `Week ${i + 1}`, count });
    }

    // ── Productivity by day of week ──
    const dayCount = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    filteredTasks.filter(t => t.status === 'completed').forEach(t => {
      if (t.dueDate) {
        const day = dayNames[new Date(t.dueDate).getDay()];
        dayCount[day]++;
      }
    });
    const productivityData = Object.entries(dayCount).map(([day, count]) => ({ day, tasks: count }));

    // ── Attendance risk summary ──
    const Subject = require('../models/Subject');
    const [subjects, records] = await Promise.all([
      Subject.find({ userId }).lean(),
      Attendance.find({ userId }).populate('subjectId', 'name').lean()
    ]);

    const filteredSubjects = hasImportedCourses
      ? subjects.filter(s => importedCourseNames.has(s.name.toLowerCase()))
      : subjects;

    const filteredRecords = hasImportedCourses
      ? records.filter(r => r.subjectId && importedCourseNames.has(r.subjectId.name.toLowerCase()))
      : records;

    const attMap = {};
    for (const s of filteredSubjects) {
      attMap[s.name] = { total: s.initialTotal || 0, present: s.initialPresent || 0 };
    }
    for (const r of filteredRecords) {
      if (!r.subjectId) continue;
      const name = r.subjectId.name;
      if (!attMap[name]) attMap[name] = { total: 0, present: 0 };
      if (r.status !== 'cancelled') {
        attMap[name].total++;
        if (r.status === 'present') attMap[name].present++;
      }
    }
    const atRiskSubjects = Object.entries(attMap)
      .filter(([, d]) => d.total > 0 && (d.present / d.total) * 100 < 75)
      .map(([name, d]) => ({ subject: name, percentage: Math.round((d.present / d.total) * 100) }));

    res.json({
      hasClassroom,
      overview: {
        totalAssignments: total,
        completed,
        pending,
        overdue,
        completionRate,
        avgCompletionHours,
        mostDemanding: mostDemanding[0] || { name: '—', count: 0 },
        atRiskCount: atRiskSubjects.length,
      },
      charts: {
        weeklyTrend: weeklyData,
        subjectWorkload: workloadBySubject,
        deadlineTimeline: deadlineData,
        productivity: productivityData,
      },
      atRiskSubjects,
    });
  } catch (err) {
    console.error('[Analytics]', err.message);
    res.status(500).json({ message: 'Failed to fetch analytics.' });
  }
};
