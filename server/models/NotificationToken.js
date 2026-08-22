const mongoose = require('mongoose');

const notificationTokenSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token:     { type: String, required: true },

  // 'web' | 'android' | 'ios' — inferred from User-Agent at registration time.
  // Stored so we can correlate failed FCM sends per platform in the DB.
  platform:  { type: String, default: 'web' },

  // Full User-Agent string from the registration request.
  // Useful for debugging OEM-specific push silencing (Samsung, MIUI, etc.).
  userAgent: { type: String, default: '' },

  lastSeen:  { type: Date, default: Date.now },
});

notificationTokenSchema.index({ userId: 1, token: 1 }, { unique: true });

module.exports = mongoose.model('NotificationToken', notificationTokenSchema);
