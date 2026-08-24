const cron = require('node-cron');
const { lockedJob } = require('../utils/safeJob');
const GoogleIntegration = require('../models/GoogleIntegration');
const ClassroomAssignment = require('../models/ClassroomAssignment');

async function syncAllUsers() {
  try {
    const integrations = await GoogleIntegration.find({});
    console.log(`[ClassroomSync] Syncing ${integrations.length} users...`);

    let sent = 0;
    let deduped = 0;
    let noTokens = 0;
    let errors = 0;
    const errorReasons = new Set();

    for (const integration of integrations) {
      try {
        const userId = integration.userId;
        const User = require('../models/User');
        const user = await User.findById(userId);
        if (!user) continue;

        // ── Respect the user's saved course selection ─────────────────────
        // If the user has never manually synced (syncedCourseIds is empty),
        // skip the background sync entirely — we have nothing to refresh and
        // we must not import courses the user never chose.
        const syncedCourseIds = integration.syncedCourseIds || [];
        if (syncedCourseIds.length === 0) {
          console.log(`[ClassroomSync] Skipping user ${userId} — no courses selected yet`);
          continue;
        }

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
        const allCourses = coursesRes.data.courses || [];

        // Filter to only the courses the user explicitly chose at sync time
        const courses = allCourses.filter(c => syncedCourseIds.includes(c.id));

        // ── Delete stale courses/assignments for courseIds that are no
        // longer in the user's selection (e.g. a course they de-selected on
        // last manual sync but the cron hadn't cleaned up yet) ─────────────
        const ClassroomCourse = require('../models/ClassroomCourse');
        await ClassroomCourse.deleteMany({ userId, courseId: { $nin: syncedCourseIds } });
        await ClassroomAssignment.deleteMany({ userId, courseId: { $nin: syncedCourseIds } });

        for (const c of courses) {
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

              // Compute priority up front from the incoming fields so it can be
              // folded into the single upsert below — avoids the previous pattern
              // of findOneAndUpdate followed by a second assignment.save() just
              // to persist priority (two writes per assignment → one).
              const priority = await calculatePriority(
                { dueDate, courseName: c.name, points, status },
                userId
              );

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
                  priority,
                  updatedAt: new Date(),
                },
                { upsert: true, new: true }
              );

              const result = await sendAssignmentNotification(assignment, userId);
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
          } catch (courseErr) {
            console.error(`[ClassroomSync] Error syncing ${c.name}:`, courseErr.message);
          }
        }

        integration.lastSync = new Date();
        await integration.save();
        console.log(`[ClassroomSync] Synced user ${userId}: ${courses.length}/${allCourses.length} selected course(s)`);
      } catch (userErr) {
        console.error(`[ClassroomSync] Error syncing user ${integration.userId}:`, userErr.message);
      }
    }

    const total = sent + deduped + noTokens + errors;
    console.log(`[ClassroomSync] All users synced. ${sent} sent, ${deduped} deduped, ${noTokens} no-tokens, ${errors} error${errors !== 1 ? 's' : ''}. Error reasons: ${[...errorReasons].join(', ') || 'none'}`);
  } catch (err) {
    console.error('[ClassroomSync]', err.message);
  }
}

function startClassroomSyncJob() {
  cron.schedule('0 */6 * * *', lockedJob('syncAllUsers', async () => {
    console.log('[Cron] Starting 6-hour classroom sync...');
    await syncAllUsers();
  }), { timezone: 'Asia/Kolkata' });
  console.log('[Cron] Classroom sync scheduled every 6 hours.');
}

module.exports = { startClassroomSyncJob, syncAllUsers };
