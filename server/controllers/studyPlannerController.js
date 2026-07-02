const Task = require('../models/Task');
const ClassroomAssignment = require('../models/ClassroomAssignment');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const { chatCompletionsCreate, NANO_MODEL } = require('../services/aiService');

const SYSTEM_PROMPT = `You are an academic productivity coach for an engineering student.

Analyze the following:
- Assignment deadlines and priority levels
- Weekly timetable to avoid clashes
- Attendance percentages (flag subjects below 75%)
- LeetCode progress and placement goals
- Daily available hours

Generate an optimized weekly study plan following these rules:
1. Prioritize CRITICAL and HIGH assignments first
2. Protect time for subjects with attendance below 75%
3. Include at least 1 placement/DSA session per day if possible
4. Never schedule during existing timetable slots
5. Prevent burnout — max 3 focused sessions per day
6. Distribute workload evenly across the week

Return ONLY a valid JSON object in this format:
{
  "plan": {
    "Monday": [
      { "startTime": "7:00 PM", "endTime": "8:00 PM", "task": "CN Assignment 4", "category": "Assignment", "priority": "HIGH" }
    ],
    ...
  },
  "insights": ["string", "string"],
  "riskAlerts": ["string"]
}`;

// POST /api/ai/generate-study-plan
exports.generatePlan = async (req, res) => {
  try {
    const userId = req.user.id;
    const { availableHoursPerDay } = req.body;

    const assignments = await ClassroomAssignment.find({
      userId,
      status: { $in: ['assigned', 'missing'] },
    }).sort({ dueDate: 1 }).lean();

    const subjects = await Subject.find({ userId }).lean();
    const attendanceRecords = await Attendance.find({ userId })
      .populate('subjectId', 'name code')
      .lean();

    const attendanceMap = {};
    for (const r of attendanceRecords) {
      if (!r.subjectId) continue;
      const name = r.subjectId.name;
      if (!attendanceMap[name]) attendanceMap[name] = { total: 0, present: 0 };
      if (r.status !== 'cancelled') {
        attendanceMap[name].total++;
        if (r.status === 'present') attendanceMap[name].present++;
      }
    }

    const timetable = subjects.flatMap(s =>
      (s.schedule || []).map(sl => ({
        day: sl.day,
        startTime: sl.startTime,
        endTime: sl.endTime,
        subject: s.name,
      }))
    );

    const input = {
      assignments: assignments.map(a => ({
        title: a.title,
        courseName: a.courseName,
        dueDate: a.dueDate,
        priority: a.priority,
        estimatedHours: a.estimatedHours,
      })),
      timetable,
      attendance: Object.entries(attendanceMap).map(([subject, data]) => ({
        subject,
        percentage: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
      })),
      availableHoursPerDay: availableHoursPerDay || 4,
    };

    const completion = await chatCompletionsCreate({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(input) },
      ],
      model: NANO_MODEL,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const text = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(text);

    // Save generated tasks to Smart Scheduler
    if (parsed.plan) {
      const dayMap = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 0 };
      const now = new Date();
      const currentDay = now.getDay();

      for (const [dayName, sessions] of Object.entries(parsed.plan)) {
        const targetDay = dayMap[dayName];
        if (targetDay === undefined) continue;

        let daysDiff = targetDay - currentDay;
        if (daysDiff < 0) daysDiff += 7;
        const sessionDate = new Date(now);
        sessionDate.setDate(sessionDate.getDate() + daysDiff);

        for (const session of sessions) {
          const timeMatch = session.startTime?.match(/(\d+):(\d+)\s*(AM|PM)?/i);
          if (!timeMatch) continue;

          let hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const ampm = timeMatch[3]?.toUpperCase();
          if (ampm === 'PM' && hours < 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;

          const startDate = new Date(sessionDate);
          startDate.setHours(hours, minutes, 0, 0);

          const endMatch = session.endTime?.match(/(\d+):(\d+)\s*(AM|PM)?/i);
          let endDate = new Date(startDate);
          if (endMatch) {
            let endH = parseInt(endMatch[1]);
            const endM = parseInt(endMatch[2]);
            const endAmpm = endMatch[3]?.toUpperCase();
            if (endAmpm === 'PM' && endH < 12) endH += 12;
            if (endAmpm === 'AM' && endH === 12) endH = 0;
            endDate.setHours(endH, endM, 0, 0);
          } else {
            endDate.setHours(endDate.getHours() + 1);
          }

          const priorityMap = { CRITICAL: 'high', HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };
          const taskPriority = priorityMap[session.priority] || 'medium';

          await Task.findOneAndUpdate(
            {
              user: userId,
              title: session.task,
              date: { $gte: new Date(startDate.toISOString().slice(0, 10)) },
            },
            {
              user: userId,
              title: session.task,
              subject: session.category === 'Assignment' ? session.task.split(' ')[0] : session.category,
              description: `${session.category} · ${session.priority} priority`,
              dueDate: startDate,
              dueTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
              priority: taskPriority,
              type: session.category?.toLowerCase() || 'other',
              status: 'pending',
            },
            { upsert: true, new: true }
          );
        }
      }
    }

    res.json({
      plan: parsed.plan || {},
      insights: parsed.insights || [],
      riskAlerts: parsed.riskAlerts || [],
    });
  } catch (err) {
    console.error('[StudyPlanner]', err.message);
    res.status(500).json({ message: 'Failed to generate study plan.' });
  }
};
