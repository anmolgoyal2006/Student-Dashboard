const admin = require('../config/firebaseAdmin');

/**
 * Send a push notification to a single device.
 * @param {string} token  - FCM device token
 * @param {string} title  - Notification title
 * @param {string} body   - Notification body
 * @param {object} data   - Optional key-value data payload
 */
async function sendNotification(token, title, body, data = {}) {
  if (!token) {
    console.warn('[FCM] sendNotification called with no token — skipping.');
    return null;
  }

  const message = {
    token,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    webpush: {
      fcmOptions: {
        link: process.env.CLIENT_URL || 'http://localhost:3000',
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('[FCM] Notification sent:', response);
    return response;
  } catch (err) {
    console.error('[FCM] Send error:', err.message);
    return null;
  }
}

module.exports = { sendNotification };