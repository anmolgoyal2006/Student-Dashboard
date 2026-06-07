const mongoose = require('mongoose');

const classroomCourseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: String, required: true },
  courseName: { type: String, required: true },
  teacherName: { type: String, default: '' },
  section: { type: String, default: '' },
  room: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

classroomCourseSchema.index({ userId: 1, courseId: 1 }, { unique: true });

module.exports = mongoose.model('ClassroomCourse', classroomCourseSchema);
