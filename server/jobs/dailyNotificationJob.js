const cron = require('node-cron');
const { sendEndOfClassNotifications } = require('../services/notificationService');

function startDailyNotificationJob() {
  // Runs every minute — fires notification when a class endTime matches now
  cron.schedule('* * * * *', async () => {
    try {
      await sendEndOfClassNotifications();
    } catch (err) {
      console.error('[CRON] Error:', err.message);
    }
  });

  console.log('[CRON] End-of-class notification job started (checks every minute).');
}

module.exports = { startDailyNotificationJob };