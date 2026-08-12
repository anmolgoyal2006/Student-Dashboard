const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  date:      { type: Date, required: true },
  status:    { type: String, enum: ['present', 'absent', 'cancelled'], required: true },
  slot:      { type: String }, // e.g., 'Mon', 'Tue', or specific slot identifier
  time:      { type: String }, // e.g., '09:00', '14:00'
}, { timestamps: true });

// Prevent duplicate entries for same subject + date + slot
attendanceSchema.index({ userId: 1, subjectId: 1, date: 1, slot: 1 }, { unique: true });
// Fast range scans for monthly trends and summary (leading userId portion)
attendanceSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
