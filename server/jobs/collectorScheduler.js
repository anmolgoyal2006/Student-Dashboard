
const cron = require('node-cron');
const { ACTIVE_COLLECTORS } = require('../collectors/registry');
const { saveEvents, detectDuplicates } = require('../services/eventService');
const { generateAndCacheRecommendations } = require('../services/recommendationCache');
const { sendDueReminders } = require('../services/reminderService');
const EventFetchLog = require('../models/EventFetchLog');
const User = require('../models/User');

let isRunning = false;

async function runCollectors() {
  if (isRunning) {
    console.log('[CRON] Collectors already running, skipping...');
    return;
  }

  isRunning = true;
  console.log('\n🔄 Running collectors...');

  try {
    for (const collectorConfig of ACTIVE_COLLECTORS) {
      const startTime = Date.now();
      let logEntry = {
        collectorName: collectorConfig.name,
        status: 'success',
        eventCount: 0,
        startedAt: new Date()
      };

      try {
        console.log(`\n📥 Fetching from ${collectorConfig.name}...`);
        const collector = new collectorConfig.collector();
        const events = await collector.fetch();
        
        logEntry.eventCount = events.length;
        console.log(`✅ ${collectorConfig.name}: ${events.length} events fetched`);
        
        await saveEvents(events);
      } catch (error) {
        logEntry.status = 'failed';
        logEntry.errorMessage = error.message;
        console.error(`❌ ${collectorConfig.name} failed:`, error.message);
      } finally {
        logEntry.completedAt = new Date();
        logEntry.duration = Date.now() - startTime;
        await EventFetchLog.create(logEntry);
      }
    }

    // Run duplicate detection
    await detectDuplicates();

    console.log('\n✅ Collector run complete');
  } catch (error) {
    console.error('[CRON] Collector scheduler error:', error.message);
  } finally {
    isRunning = false;
  }
}

async function refreshAllRecommendations() {
  console.log('\n🔄 Refreshing recommendations for all users...');
  try {
    const students = await User.find({ role: 'student' });
    let successCount = 0;
    let failCount = 0;

    for (const student of students) {
      try {
        await generateAndCacheRecommendations(student._id);
        successCount++;
      } catch (err) {
        console.error(`[CRON] Failed to refresh recommendations for user ${student._id}:`, err);
        failCount++;
      }
    }

    console.log(`✅ Recommendations refreshed: ${successCount} succeeded, ${failCount} failed`);
  } catch (error) {
    console.error('[CRON] Recommendation refresh error:', error.message);
  }
}

function startCollectorScheduler() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', runCollectors, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });

  // Refresh recommendations every 6 hours
  cron.schedule('0 */6 * * *', refreshAllRecommendations, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });

  // Check for due reminders every hour
  cron.schedule('0 * * * *', sendDueReminders, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });

  // Also run immediately on startup
  console.log('[CRON] Collector scheduler started (every 15 minutes).');
  console.log('[CRON] Recommendation refresh started (every 6 hours).');
  console.log('[CRON] Reminder checker started (every hour).');
  runCollectors();
}

module.exports = { startCollectorScheduler, runCollectors, refreshAllRecommendations };
