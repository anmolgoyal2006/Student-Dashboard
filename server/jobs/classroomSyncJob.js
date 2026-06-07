const cron = require('node-cron');
const GoogleIntegration = require('../models/GoogleIntegration');
const ClassroomAssignment = require('../models/ClassroomAssignment');

async function syncAllUsers() {
  try {
    const integrations = await GoogleIntegration.find({});
    console.log(`[ClassroomSync] Syncing ${integrations.length} users...`);

    for (const integration of integrations) {
      try {
        const userId = integration.userId;
        const User = require('../models/User');
        const user = await User.findById(userId);
        if (!user) continue;

        // Simulate a request to the sync endpoint
        const { google } = require('googleapis');
        const { calculatePriority } = require('../services/priorityEngine');
        const { sendAssignmentNotification } = require('../services/notificationEngine');

        const oauth2 = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );

        if (integration.tokenExpiry && new Date(integration.tokenExpiry) < new Date()) {
          oauth2.setCredentials({ refresh_token: integration.refreshToken });
          const { credentials } = await oauth2.refreshAccessToken();
          integration.accessToken = credentials.access_token;
          integration.tokenExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
        }

        oauth2.setCredentials({ access_token: integration.accessToken });
        const classroom = google.classroom({ version: 'v1', auth: oauth2 });

        const coursesRes = await classroom.courses.list({ courseStates: ['ACTIVE'] });
        const courses = coursesRes.data.courses || [];

        for (const c of courses) {
          const ClassroomCourse = require('../models/ClassroomCourse');
          await ClassroomCourse.findOneAndUpdate(
            { userId, courseId: c.id },
            {
              userId, courseId: c.id, courseName: c.name,
              teacherName: c.owner?.displayName || '',
              section: c.section || '', room: c.room || '',
            },
            { upsert: true, new: true }
          );

          try {
            const workRes = await classroom.courses.courseWork.list({ courseId: c.id });
            const coursework = workRes.data.courseWork || [];

            for (const w of coursework) {
              // Skip MATERIAL type (announcements, resources)
              if (w.workType === 'MATERIAL') continue;

              const dueDate = w.dueDate
                ? new Date(w.dueDate.year, w.dueDate.month - 1, w.dueDate.day,
                    w.dueTime?.hours || 23, w.dueTime?.minutes || 59)
                : null;

              const points = w.maxPoints || 0;
              const estimated = points >= 80 ? 4 : points >= 50 ? 3 : points >= 20 ? 2 : 1;

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
                // Submission check may fail — proceed with default status
              }

              const status = submitted ? 'submitted' : (w.state === 'PUBLISHED' ? 'assigned' : w.state?.toLowerCase() || 'assigned');

              const assignment = await ClassroomAssignment.findOneAndUpdate(
                { userId, courseId: c.id, assignmentId: w.id },
                {
                  userId, courseId: c.id, courseName: c.name, assignmentId: w.id,
                  title: w.title, description: w.description || '', dueDate,
                  dueTime: w.dueTime ? `${String(w.dueTime.hours || 23).padStart(2, '0')}:${String(w.dueTime.minutes || 59).padStart(2, '0')}` : '23:59',
                  status,
                  points, maxPoints: points,
                  assignmentUrl: w.alternateLink || '',
                  estimatedHours: estimated,
                  updatedAt: new Date(),
                },
                { upsert: true, new: true }
              );

              assignment.priority = await calculatePriority(assignment, userId);
              await assignment.save();

              await sendAssignmentNotification(assignment, userId);
            }
          } catch (courseErr) {
            console.error(`[ClassroomSync] Error syncing ${c.name}:`, courseErr.message);
          }
        }

        integration.lastSync = new Date();
        await integration.save();
        console.log(`[ClassroomSync] Synced ${userId}: ${courses.length} courses`);
      } catch (userErr) {
        console.error(`[ClassroomSync] Error syncing user ${integration.userId}:`, userErr.message);
      }
    }

    console.log('[ClassroomSync] All users synced.');
  } catch (err) {
    console.error('[ClassroomSync]', err.message);
  }
}

function startClassroomSyncJob() {
  cron.schedule('0 */6 * * *', () => {
    console.log('[Cron] Starting 6-hour classroom sync...');
    syncAllUsers();
  }, { timezone: 'Asia/Kolkata' });
  console.log('[Cron] Classroom sync scheduled every 6 hours.');
}

module.exports = { startClassroomSyncJob, syncAllUsers };
