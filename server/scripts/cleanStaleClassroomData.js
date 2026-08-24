/**
 * cleanStaleClassroomData.js
 *
 * One-off cleanup script: removes ClassroomCourse and ClassroomAssignment
 * documents that belong to courses the user never selected (or de-selected).
 *
 * Safe to run multiple times — it is idempotent.
 *
 * Usage:
 *   node server/scripts/cleanStaleClassroomData.js
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mongoose          = require('mongoose');
const GoogleIntegration = require('../models/GoogleIntegration');
const ClassroomCourse   = require('../models/ClassroomCourse');
const ClassroomAssignment = require('../models/ClassroomAssignment');
const Task              = require('../models/Task');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true, useUnifiedTopology: true,
  });
  console.log('[cleanStaleClassroomData] Connected\n');

  const integrations = await GoogleIntegration.find({}).lean();
  console.log(`[cleanStaleClassroomData] ${integrations.length} integration(s) found\n`);

  let totalCourses = 0, totalAssignments = 0, totalTasks = 0;

  for (const intg of integrations) {
    const userId   = intg.userId;
    const synced   = intg.syncedCourseIds || [];

    const stored   = await ClassroomCourse.find({ userId }).lean();
    const stale    = stored.filter(c => !synced.includes(c.courseId));

    console.log(`User ${userId}`);
    console.log(`  syncedCourseIds : [${synced.join(', ') || 'none'}]`);
    console.log(`  stored courses  : [${stored.map(c => c.courseId).join(', ') || 'none'}]`);
    console.log(`  stale courses   : [${stale.map(c => c.courseId).join(', ') || 'none'}]`);

    if (synced.length === 0) {
      // User has never manually synced — wipe everything classroom-related
      const rc = await ClassroomCourse.deleteMany({ userId });
      const ra = await ClassroomAssignment.deleteMany({ userId });
      const rt = await Task.deleteMany({ user: userId, type: 'assignment' });
      console.log(`  → [never synced] deleted ${rc.deletedCount} courses, ${ra.deletedCount} assignments, ${rt.deletedCount} tasks`);
      totalCourses     += rc.deletedCount;
      totalAssignments += ra.deletedCount;
      totalTasks       += rt.deletedCount;
    } else if (stale.length > 0) {
      // Wipe only stale courses and their assignments
      const staleIds = stale.map(c => c.courseId);
      const staleNames = stale.map(c => c.courseName);

      const rc = await ClassroomCourse.deleteMany({ userId, courseId: { $nin: synced } });
      const ra = await ClassroomAssignment.deleteMany({ userId, courseId: { $nin: synced } });
      const rt = await Task.deleteMany({ user: userId, type: 'assignment', subject: { $in: staleNames } });
      console.log(`  → deleted ${rc.deletedCount} courses, ${ra.deletedCount} assignments, ${rt.deletedCount} tasks`);
      totalCourses     += rc.deletedCount;
      totalAssignments += ra.deletedCount;
      totalTasks       += rt.deletedCount;
    } else {
      console.log('  → clean — nothing to delete');
    }
    console.log();
  }

  console.log('─'.repeat(60));
  console.log(`Total deleted: ${totalCourses} courses, ${totalAssignments} assignments, ${totalTasks} tasks`);
  console.log('[cleanStaleClassroomData] Done');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[cleanStaleClassroomData] Fatal:', err.message);
  process.exit(1);
});
