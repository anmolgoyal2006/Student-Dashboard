const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,       // fast lookups by user
    },
    title: {
      type:     String,
      required: true,
    },
    body: {
      type:     String,
      required: true,
    },
    subjectId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Subject',
      default: null,
    },
  type: {
    type: String,
    enum: [
      'ATTENDANCE_MARK',
      'EVENT_REMINDER',
      // Assignment / classroom
      'CLASSROOM',
      'NEW_ASSIGNMENT',
      'OVERDUE',
      'URGENT',
      'DUE_SOON',
      // Study session
      'SESSION_SOON',
      'SESSION_START',
      // Risk / academic
      'RISK_ALERT',
      // Digest / general
      'DIGEST',
      'INFO',
      'WARNING',
      'DANGER',
    ],
    default: 'INFO',
  },
  courseName: {
    type:    String,
    default: null,
  },
  // Deduplication key — set to a stable string (e.g. "YYYY-MM-DD") so the unique
  // index above can prevent duplicate documents without a racy findOne check.
  dedupKey: {
    type:    String,
    default: null,
  },
  read: {
      type:    Boolean,
      default: false,
    },
  },
  { timestamps: true }   // createdAt + updatedAt added automatically
);

// For fast lookup/dedup queries
notificationSchema.index({ userId: 1, type: 1, title: 1, body: 1, createdAt: -1 });

// Dedup key: one notification per user+type+title per "bucket" day (stored as a separate field).
// This lets us do an atomic findOneAndUpdate upsert instead of a racy check-then-insert.
notificationSchema.index(
  { userId: 1, type: 1, title: 1, dedupKey: 1 },
  { unique: true, sparse: true }   // sparse so existing docs without dedupKey are unaffected
);

module.exports = mongoose.model('Notification', notificationSchema);