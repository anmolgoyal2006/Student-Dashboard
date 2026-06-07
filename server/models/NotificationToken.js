const mongoose = require('mongoose');

const notificationTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true },
  platform: { type: String, default: 'web' },
  lastSeen: { type: Date, default: Date.now },
});

notificationTokenSchema.index({ userId: 1, token: 1 }, { unique: true });

module.exports = mongoose.model('NotificationToken', notificationTokenSchema);
