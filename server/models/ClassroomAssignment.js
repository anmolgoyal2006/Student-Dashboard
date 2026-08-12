const mongoose = require('mongoose');

const classroomAssignmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: String, required: true },
  courseName: { type: String, default: '' },
  assignmentId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  dueDate: { type: Date },
  dueTime: { type: String, default: '23:59' },
  status: { type: String, enum: ['assigned', 'submitted', 'returned', 'missing'], default: 'assigned' },
  points: { type: Number, default: 0 },
  maxPoints: { type: Number, default: 0 },
  assignmentUrl: { type: String, default: '' },
  estimatedHours: { type: Number, default: 1 },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

classroomAssignmentSchema.index({ userId: 1, courseId: 1, assignmentId: 1 }, { unique: true });
// Cron queries: filter by status + dueDate across all users every hour
classroomAssignmentSchema.index({ status: 1, dueDate: 1 });

module.exports = mongoose.model('ClassroomAssignment', classroomAssignmentSchema);
