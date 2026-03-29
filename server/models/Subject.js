const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:       { type: String, required: true, trim: true },
  code:       { type: String, required: true, trim: true },
  instructor: { type: String, default: '' },
  credits:    { type: Number, required: true, min: 1, max: 6 },
  schedule:   [{
    day:       { type: String, enum: ['Mon','Tue','Wed','Thu','Fri','Sat'] },
    startTime: { type: String },
    endTime:   { type: String },
    room:      { type: String, default: '' },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Subject', subjectSchema);
