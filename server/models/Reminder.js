
const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  eventTitle: {
    type: String,
    required: true
  },
  reminderType: {
    type: String,
    enum: ['7_DAYS', '3_DAYS', '1_DAY', '6_HOURS'],
    required: true
  },
  deadline: {
    type: Date,
    required: true
  },
  sendAt: {
    type: Date,
    required: true,
    index: true
  },
  sent: {
    type: Boolean,
    default: false
  },
  sentAt: Date,
  // A reminder that keeps throwing (deleted user, bad data) would otherwise be
  // re-fetched by the hourly job forever. Capped by MAX_SEND_ATTEMPTS.
  attempts: {
    type: Number,
    default: 0
  },
  lastError: String
}, { timestamps: true });

module.exports = mongoose.model('Reminder', reminderSchema);
