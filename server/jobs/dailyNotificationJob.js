// jobs/dailyNotificationJob.js
const cron        = require('node-cron');
const { sendTodayNotifications } = require('../services/notificationService');

/**
 * Runs every day at 8:00 AM server time.
 * Fetches today's timetable for ALL users and sends class notifications.
 */
function startDailyNotificationJob() {
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Running daily notification job:', new Date().toISOString());
    try {
      await sendTodayNotifications();
      console.log('[CRON] Daily notifications sent successfully.');
    } catch (err) {
      console.error('[CRON] Error sending notifications:', err.message);
    }
  });

  console.log('[CRON] Daily notification job scheduled at 8:00 AM.');
}

module.exports = { startDailyNotificationJob };