const mongoose = require('mongoose');

const marksSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  subjectId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  examType:      { type: String, enum: ['midterm', 'final', 'quiz', 'assignment', 'practical'], required: true },
  marksObtained: { type: Number, required: true, min: 0 },
  maxMarks:      { type: Number, required: true, min: 1 },
  gradePoint:    { type: Number, min: 0, max: 10 },
  examDate:      { type: Date },
}, { timestamps: true });

// Auto-calculate gradePoint before save (10-point scale)
marksSchema.pre('save', function (next) {
  const percentage = (this.marksObtained / this.maxMarks) * 100;
  if      (percentage >= 90) this.gradePoint = 10;
  else if (percentage >= 80) this.gradePoint = 9;
  else if (percentage >= 70) this.gradePoint = 8;
  else if (percentage >= 60) this.gradePoint = 7;
  else if (percentage >= 50) this.gradePoint = 6;
  else if (percentage >= 40) this.gradePoint = 5;
  else                       this.gradePoint = 4;
  next();
});

module.exports = mongoose.model('Marks', marksSchema);
