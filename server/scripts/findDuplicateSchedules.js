/**
 * findDuplicateSchedules.js
 *
 * One-off diagnostic script: finds Subject documents that have two or more
 * schedule entries on the same day whose endTimes differ by ≤ 10 minutes.
 * This is the pattern that caused the real double-notification for
 * "Discrete Mathematics" at 01:05 and 01:10 on the same Friday.
 *
 * Usage (from the repo root):
 *   node server/scripts/findDuplicateSchedules.js
 *
 * Set MONGODB_URI in your environment or .env before running.
 * The script is READ-ONLY — it never writes or deletes anything.
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Subject  = require('../models/Subject');

// How close two endTimes must be (in minutes) to be flagged as a duplicate.
const THRESHOLD_MINUTES = 10;

// ─── Convert "HH:MM" (24h) or "H:MM AM/PM" to minutes-since-midnight ────────
function toMinutes(timeStr) {
  if (!timeStr) return null;

  const str = timeStr.trim().toUpperCase();

  // 12-hour format: "1:05 PM", "01:05PM"
  const m12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = parseInt(m12[2], 10);
    if (m12[3] === 'PM' && h < 12) h += 12;
    if (m12[3] === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }

  // 24-hour format: "01:05", "13:10"
  const m24 = str.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    return parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10);
  }

  return null; // unparseable — treat as missing
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser   : true,
    useUnifiedTopology: true,
  });
  console.log('[findDuplicateSchedules] Connected to MongoDB\n');

  const subjects = await Subject.find({}).lean();
  console.log(`[findDuplicateSchedules] Scanning ${subjects.length} subjects...\n`);

  const flagged = [];

  for (const subject of subjects) {
    if (!subject.schedule || subject.schedule.length < 2) continue;

    // Group schedule entries by day
    const byDay = {};
    for (const entry of subject.schedule) {
      if (!entry.day) continue;
      if (!byDay[entry.day]) byDay[entry.day] = [];
      byDay[entry.day].push(entry);
    }

    for (const [day, entries] of Object.entries(byDay)) {
      if (entries.length < 2) continue;

      // Compare every pair of entries on the same day
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const a = entries[i];
          const b = entries[j];

          const endA = toMinutes(a.endTime);
          const endB = toMinutes(b.endTime);

          if (endA === null || endB === null) continue;

          const diff = Math.abs(endA - endB);
          if (diff <= THRESHOLD_MINUTES) {
            flagged.push({
              subjectId  : String(subject._id),
              userId     : String(subject.userId),
              subjectName: subject.name,
              day,
              slotA: {
                startTime: a.startTime || '(none)',
                endTime  : a.endTime   || '(none)',
                room     : a.room      || '(none)',
                _id      : String(a._id || '(no _id)'),
              },
              slotB: {
                startTime: b.startTime || '(none)',
                endTime  : b.endTime   || '(none)',
                room     : b.room      || '(none)',
                _id      : String(b._id || '(no _id)'),
              },
              endTimeDiffMinutes: diff,
            });
          }
        }
      }
    }
  }

  if (flagged.length === 0) {
    console.log('✅  No duplicate schedule entries found within the threshold.');
  } else {
    console.log(`⚠️  Found ${flagged.length} suspect pair(s):\n`);

    for (const f of flagged) {
      console.log('─'.repeat(72));
      console.log(`Subject : "${f.subjectName}"  (id: ${f.subjectId})`);
      console.log(`User    : ${f.userId}`);
      console.log(`Day     : ${f.day}`);
      console.log(`Slot A  : start=${f.slotA.startTime}  end=${f.slotA.endTime}  room=${f.slotA.room}  _id=${f.slotA._id}`);
      console.log(`Slot B  : start=${f.slotB.startTime}  end=${f.slotB.endTime}  room=${f.slotB.room}  _id=${f.slotB._id}`);
      console.log(`endTime diff: ${f.endTimeDiffMinutes} minute(s)  ← within ${THRESHOLD_MINUTES}-min threshold`);
      console.log();
    }

    console.log('─'.repeat(72));
    console.log('\nTo remove a duplicate slot, run in mongo shell or Compass:');
    console.log('  db.subjects.updateOne(');
    console.log('    { _id: ObjectId("<subjectId>") },');
    console.log('    { $pull: { schedule: { _id: ObjectId("<slotId to remove>") } } }');
    console.log('  )');
    console.log('\nThis script made NO changes. All deduplication must be done manually.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[findDuplicateSchedules] Fatal error:', err.message);
  process.exit(1);
});
