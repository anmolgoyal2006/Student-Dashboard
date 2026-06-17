const { google } = require('googleapis');
const GoogleIntegration = require('../models/GoogleIntegration');
const ClassroomCourse = require('../models/ClassroomCourse');
const ClassroomAssignment = require('../models/ClassroomAssignment');
const Task = require('../models/Task');
const { calculatePriority } = require('../services/priorityEngine');
const { sendAssignmentNotification } = require('../services/notificationEngine');

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails',
];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CLASSROOM_REDIRECT || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/classroom/callback`
  );
}

// GET /api/classroom/auth
exports.auth = (req, res) => {
  const oauth2 = getOAuth2Client();
  const origin = req.query.origin || process.env.FRONTEND_URL || 'http://localhost:3000';
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: JSON.stringify({ userId: req.user.id, origin }),
    prompt: 'consent',
  });
  res.json({ url });
};

// GET /api/classroom/callback
exports.callback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const oauth2 = getOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    let userId, origin;
    try {
      const parsed = JSON.parse(state);
      userId = parsed.userId;
      origin = parsed.origin;
    } catch {
      userId = state;
      origin = null;
    }

    let email = '';
    let googleId = '';
    let name = '';

    if (tokens.id_token) {
      const ticket = await oauth2.verifyIdToken({ idToken: tokens.id_token });
      const payload = ticket.getPayload();
      email = payload.email || '';
      googleId = payload.sub || '';
      name = payload.name || '';
    }

    // Fallback: if no id_token, get profile via Google People API or tokeninfo
    if (!email && tokens.access_token) {
      try {
        const { data } = await google.oauth2('v2').userinfo.get({ oauth_token: tokens.access_token });
        email = data.email || '';
        googleId = data.id || '';
        name = data.name || '';
      } catch (e) {
        console.error('[Classroom Callback] userinfo fallback failed:', e.message);
      }
    }

    await GoogleIntegration.findOneAndUpdate(
      { userId },
      {
        userId,
        email,
        googleId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        connectedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    const frontendUrl = origin || process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/scheduler?classroom=connected`);
  } catch (err) {
    console.error('[Classroom Callback]', err.message);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/scheduler?classroom=error`);
  }
};

// GET /api/classroom/status
exports.status = async (req, res) => {
  try {
    const integration = await GoogleIntegration.findOne({ userId: req.user.id });
    if (!integration) {
      return res.json({ connected: false });
    }
    const expired = integration.tokenExpiry && new Date(integration.tokenExpiry) < new Date();
    res.json({ connected: true, email: integration.email, lastSync: integration.lastSync, needsReauth: expired });
  } catch (err) {
    console.error('[Classroom Status]', err.message);
    res.status(500).json({ message: 'Failed to check status.' });
  }
};

// DELETE /api/classroom/disconnect
exports.disconnect = async (req, res) => {
  try {
    await GoogleIntegration.findOneAndDelete({ userId: req.user.id });
    await ClassroomCourse.deleteMany({ userId: req.user.id });
    await ClassroomAssignment.deleteMany({ userId: req.user.id });
    await Task.deleteMany({ user: req.user.id, type: 'assignment' });
    res.json({ message: 'Google Classroom disconnected.' });
  } catch (err) {
    console.error('[Classroom Disconnect]', err.message);
    res.status(500).json({ message: 'Failed to disconnect.' });
  }
};

// GET /api/classroom/courses
exports.getCourses = async (req, res) => {
  try {
    const courses = await ClassroomCourse.find({ userId: req.user.id }).sort({ courseName: 1 });
    res.json({ courses });
  } catch (err) {
    console.error('[Classroom GetCourses]', err.message);
    res.status(500).json({ message: 'Failed to fetch courses.' });
  }
};

// GET /api/classroom/courses/available — fetch courses from Google Classroom API
exports.listCourses = async (req, res) => {
  try {
    const { classroom } = await getAuthenticatedClient(req.user.id);
    const coursesRes = await classroom.courses.list({ courseStates: ['ACTIVE'] });
    const courses = (coursesRes.data.courses || []).map(c => ({
      courseId: c.id,
      courseName: c.name,
      section: c.section || '',
      teacher: c.owner?.displayName || '',
      enrollmentCode: c.enrollmentCode || '',
    }));
    res.json({ courses });
  } catch (err) {
    console.error('[Classroom ListCourses]', err.message);
    res.status(500).json({ message: 'Failed to list courses.' });
  }
};

// GET /api/classroom/assignments
exports.getAssignments = async (req, res) => {
  try {
    const { courseId } = req.query;
    const filter = { userId: req.user.id, status: { $nin: ['submitted', 'returned'] } };
    if (courseId) filter.courseId = courseId;
    const assignments = await ClassroomAssignment.find(filter)
      .sort({ dueDate: 1 })
      .lean();
    res.json({ assignments });
  } catch (err) {
    console.error('[Classroom GetAssignments]', err.message);
    res.status(500).json({ message: 'Failed to fetch assignments.' });
  }
};

// ─── helpers ───────────────────────────────────────────────────────────────

async function refreshAccessToken(integration) {
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ refresh_token: integration.refreshToken });
  const { credentials } = await oauth2.refreshAccessToken();
  integration.accessToken = credentials.access_token;
  integration.tokenExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
  integration.lastSync = new Date();
  await integration.save();
  return credentials.access_token;
}

async function getAuthenticatedClient(userId) {
  const integration = await GoogleIntegration.findOne({ userId });
  if (!integration) throw new Error('Google Classroom not connected');

  if (integration.tokenExpiry && new Date(integration.tokenExpiry) < new Date()) {
    await refreshAccessToken(integration);
  }

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ access_token: integration.accessToken });
  return { integration, classroom: google.classroom({ version: 'v1', auth: oauth2 }) };
}

function estimateHours(assignment) {
  const p = assignment.maxPoints || assignment.points || 0;
  if (p >= 80) return 4;
  if (p >= 50) return 3;
  if (p >= 20) return 2;
  const titleLen = (assignment.title || '').length;
  if (titleLen > 50) return 3;
  if (titleLen > 20) return 2;
  return 1;
}

// POST /api/classroom/sync
exports.sync = async (req, res) => {
  try {
    const { classroom, integration } = await getAuthenticatedClient(req.user.id);
    const userId = req.user.id;

    // Clear all previous classroom data before re-importing
    await ClassroomCourse.deleteMany({ userId });
    await ClassroomAssignment.deleteMany({ userId });
    await Task.deleteMany({ user: userId, type: 'assignment' });

    // Fetch courses
    const coursesRes = await classroom.courses.list({
      courseStates: ['ACTIVE'],
    });
    let courses = coursesRes.data.courses || [];

    // Filter by selected courseIds if provided
    const { courseIds } = req.body;
    if (courseIds && Array.isArray(courseIds) && courseIds.length > 0) {
      courses = courses.filter(c => courseIds.includes(c.id));
    }

    const courseMap = {};
    for (const c of courses) {
      await ClassroomCourse.findOneAndUpdate(
        { userId, courseId: c.id },
        {
          userId,
          courseId: c.id,
          courseName: c.name,
          teacherName: c.owner?.displayName || '',
          section: c.section || '',
          room: c.room || '',
        },
        { upsert: true, new: true }
      );
      courseMap[c.id] = c.name;
    }

    // Fetch coursework for each course
    let allAssignments = [];
    for (const c of courses) {
      try {
        const workRes = await classroom.courses.courseWork.list({ courseId: c.id });
        const coursework = workRes.data.courseWork || [];

        for (const w of coursework) {
          const dueDate = w.dueDate
            ? new Date(w.dueDate.year, w.dueDate.month - 1, w.dueDate.day,
                w.dueTime?.hours || 23, w.dueTime?.minutes || 59)
            : null;

          // Skip MATERIAL type (announcements, resources — not assignments)
          if (w.workType === 'MATERIAL') continue;

          const estimated = estimateHours(w);

          // Check student submission status
          let submitted = false;
          try {
            const subRes = await classroom.courses.courseWork.studentSubmissions.list({
              courseId: c.id,
              courseWorkId: w.id,
            });
            const submissions = subRes.data.studentSubmissions || [];
            submitted = submissions.some(s => s.state === 'TURNED_IN' || s.state === 'RETURNED');
          } catch (e) {
            console.log(`[Classroom Sync] Submissions check skipped for "${w.title}": ${e.message}`);
          }

          const status = submitted ? 'submitted' : (w.state === 'PUBLISHED' ? 'assigned' : w.state?.toLowerCase() || 'assigned');

          const assignment = await ClassroomAssignment.findOneAndUpdate(
            { userId, courseId: c.id, assignmentId: w.id },
            {
              userId,
              courseId: c.id,
              courseName: c.name,
              assignmentId: w.id,
              title: w.title,
              description: w.description || '',
              dueDate,
              dueTime: w.dueTime ? `${String(w.dueTime.hours || 23).padStart(2, '0')}:${String(w.dueTime.minutes || 59).padStart(2, '0')}` : '23:59',
              status,
              points: w.maxPoints || 0,
              maxPoints: w.maxPoints || 0,
              assignmentUrl: w.alternateLink || '',
              estimatedHours: estimated,
              updatedAt: new Date(),
            },
            { upsert: true, new: true }
          );

          assignment.priority = await calculatePriority(assignment, userId);
          await assignment.save();

          // Create or update task in Smart Scheduler
          if (dueDate) {
            const taskStatus = submitted ? 'completed' : 'pending';
            const existingTask = await Task.findOne({
              user: userId,
              title: w.title,
              dueDate: dueDate,
            });
            if (existingTask) {
              if (submitted && existingTask.status !== 'completed') {
                existingTask.status = 'completed';
                await existingTask.save();
              }
            } else {
              await Task.create({
                user: userId,
                title: w.title,
                subject: c.name,
                description: w.description?.slice(0, 200) || '',
                dueDate,
                dueTime: w.dueTime ? `${String(w.dueTime.hours || 23).padStart(2, '0')}:${String(w.dueTime.minutes || 59).padStart(2, '0')}` : '23:59',
                priority: assignment.priority.toLowerCase(),
                type: 'assignment',
                status: taskStatus,
              });
            }
          }

          allAssignments.push(assignment);
        }
      } catch (courseErr) {
        console.error(`[Classroom Sync] Error syncing course ${c.name}:`, courseErr.message);
      }
    }

    integration.lastSync = new Date();
    await integration.save();

    // Send notifications for new assignments
    let sent = 0;
    let deduped = 0;
    let noTokens = 0;
    let errors = 0;
    const errorReasons = new Set();
    for (const a of allAssignments) {
      const result = await sendAssignmentNotification(a, userId);
      if (result.success) {
        sent++;
      } else if (result.skipped) {
        // Skip (assignment already submitted or completed) — don't count in any bucket
      } else if (result.reason === 'Duplicate within 24h') {
        deduped++;
      } else if (result.reason === 'No tokens') {
        noTokens++;
      } else {
        errors++;
        errorReasons.add(result.error || result.reason);
      }
    }

    const total = sent + deduped + noTokens + errors;
    console.log(`[Classroom Controller Sync] ${sent} sent, ${deduped} deduped, ${noTokens} no-tokens, ${errors} error${errors !== 1 ? 's' : ''}. Error reasons: ${[...errorReasons].join(', ') || 'none'}`);

    res.json({ message: 'Sync completed', courses: courses.length, assignments: allAssignments.length });
  } catch (err) {
    console.error('[Classroom Sync]', err.message);
    res.status(500).json({ message: 'Failed to sync Google Classroom.' });
  }
};
