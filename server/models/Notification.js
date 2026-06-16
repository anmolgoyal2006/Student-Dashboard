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
    enum: ['ATTENDANCE_MARK', 'EVENT_REMINDER'],
    default: 'ATTENDANCE_MARK',
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

module.exports = mongoose.model('Notification', notificationSchema);