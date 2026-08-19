const cron = require('node-cron');
const { sendEndOfClassNotifications, sendTodayNotifications } = require('../services/notificationService');

// Note: concurrency guards (isRunning flags) live inside notificationService.js.
// Both functions are safe to call without additional guards here.

function getISTInfo() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
    weekday: 'short'
  }).format(new Date());
}

function startDailyNotificationJob() {
  // Every minute: check for classes ending NOW and send "Did you attend?" prompt
  cron.schedule('* * * * *', async () => {
    console.log(`[CRON] sendEndOfClassNotifications started (IST Time: ${getISTInfo()})`);
    try {
      await sendEndOfClassNotifications();
    } catch (err) {
      console.error('[CRON] End-of-class error:', err.message);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });

  // Every day at 8:00 AM IST: send start-of-day reminders
  cron.schedule('0 8 * * 1-5', async () => {
    console.log(`[CRON] sendTodayNotifications started (IST Time: ${getISTInfo()})`);
    try {
      await sendTodayNotifications();
    } catch (err) {
      console.error('[CRON] Start-of-day error:', err.message);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });

  console.log('[CRON] Notification jobs started (IST timezone).');
}

module.exports = { startDailyNotificationJob };