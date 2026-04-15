const mongoose = require('mongoose');
const { VALID_GRADES } = require('../config/gradeConfig');

const SubjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true,
  },
  credits: {
    type: Number,
    required: [true, 'Credits are required'],
    min: [1, 'Credits must be greater than 0'],
  },
  grade: {
    type: String,
    required: [true, 'Grade is required'],
    enum: {
      values: VALID_GRADES,
      message: `Grade must be one of: ${VALID_GRADES.join(', ')}`,
    },
  },
});

const SemesterSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    semesterNumber: {
      type: Number,
      required: [true, 'Semester number is required'],
      min: [1, 'Semester number must be at least 1'],
    },
    semesterName: {
      type: String,
      trim: true,
    },
 subjects: {
      type: [SubjectSchema],
      default: [],
    },
    isManual: {
      type: Boolean,
      default: false,
    },
    directSGPA: {
      type: Number,
      default: null,
    },
    sgpa: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Auto-compute SGPA before saving
SemesterSchema.pre('save', function (next) {
  if (this.isManual && this.directSGPA !== null) {
    this.sgpa = this.directSGPA;
    return next();
  }
  if (!this.isManual && (!this.subjects || this.subjects.length === 0)) {
    return next(new Error('At least one subject is required'));
  }
  const { calculateSGPA } = require('../utils/gradeUtils');
  this.sgpa = calculateSGPA(this.subjects);
  next();
});

module.exports = mongoose.model('Semester', SemesterSchema);