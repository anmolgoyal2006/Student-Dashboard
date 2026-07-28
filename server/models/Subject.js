const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:   { type: String, required: true, trim: true },

  // [CHANGED] required → false + default: AI commands rarely include these
  code:       { type: String, required: false, trim: true, default: '' },
  credits:    { type: Number, required: false, min: 1, max: 6, default: null },
  instructor: { type: String, default: '' },

  schedule: [{
    day: { type: String, enum: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] },
    startTime: { type: String },
    endTime:   { type: String },
    room:      { type: String, default: '' },
  }],
  initialPresent: { type: Number, default: 0, min: 0 },
  initialTotal:   { type: Number, default: 0, min: 0 },
}, { timestamps: true });

// [CHANGED] Auto-generate code from name if still empty before saving
// Ensures Subject.create() never fails due to missing code
subjectSchema.pre('save', function (next) {
  if (!this.code && this.name) {
    this.code = this.name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
  }
  next();
});

module.exports = mongoose.model('Subject', subjectSchema);