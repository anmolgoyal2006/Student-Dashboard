const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  date:      { type: Date, required: true },
  status:    { type: String, enum: ['present', 'absent', 'cancelled'], required: true },
}, { timestamps: true });

// Prevent duplicate entries for same subject + date
attendanceSchema.index({ userId: 1, subjectId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
