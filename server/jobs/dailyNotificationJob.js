const cron = require('node-cron');
const { sendEndOfClassNotifications } = require('../services/notificationService');

let isRunning = false;

function startDailyNotificationJob() {
  cron.schedule('* * * * *', async () => {
    // Skip if previous run is still in progress
    if (isRunning) return;
    isRunning = true;
    try {
      await sendEndOfClassNotifications();
    } catch (err) {
      console.error('[CRON] Error:', err.message);
    } finally {
      isRunning = false;
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata'   // ← YOUR timezone (IST)
  });

  console.log('[CRON] End-of-class notification job started (IST timezone).');
}

module.exports = { startDailyNotificationJob };