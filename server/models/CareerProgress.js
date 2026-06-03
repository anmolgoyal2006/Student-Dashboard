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
  resumeFeedback:  [{ type: String }],
  resumeKeywords:  [{ type: String }],
  activeInterview: {
    topic:       { type: String, default: '' },
    activeIndex: { type: Number, default: 0 },
    questions:   [{
      id:          { type: Number },
      question:    { type: String },
      type:        { type: String },
      userAnswer:  { type: String, default: '' },
      score:       { type: Number, default: 0 },
      feedback:    { type: String, default: '' },
      modelAnswer: { type: String, default: '' },
      isEvaluated: { type: Boolean, default: false },
    }],
  },
  mockInterviews: [{
    topic:       { type: String },
    question:    { type: String },
    userAnswer:  { type: String },
    score:       { type: Number },
    feedback:    { type: String },
    modelAnswer: { type: String },
    createdAt:   { type: Date, default: Date.now },
  }],
}, { timestamps: true });

module.exports = mongoose.model('CareerProgress', careerSchema);
