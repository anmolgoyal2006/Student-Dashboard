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
  read: {
      type:    Boolean,
      default: false,
    },
  },
  { timestamps: true }   // createdAt + updatedAt added automatically
);

notificationSchema.index({ userId: 1, type: 1, title: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);