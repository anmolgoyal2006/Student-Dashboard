const mongoose = require('mongoose');

const dsaTopicSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  completed: { type: Boolean, default: false },
  problems:  { type: Number, default: 0 },
});

const careerSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  targetCompany:   { type: String, enum: ['Amazon','Microsoft','Google','Flipkart','Adobe','Infosys','TCS','Other'], default: 'Other' },
  targetRole:      { type: String, default: 'Software Engineer' },
  problemsSolved:  { type: Number, default: 0 },
  readiness:       { type: String, enum: ['Beginner','Intermediate','Ready'], default: 'Beginner' },
  dsaTopics: [dsaTopicSchema],
  skills:          [{ type: String }],
  resumeScore:     { type: Number, default: 0, min: 0, max: 100 },
}, { timestamps: true });

module.exports = mongoose.model('CareerProgress', careerSchema);
