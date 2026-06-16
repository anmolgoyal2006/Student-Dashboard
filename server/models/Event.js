
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  registrationUrl: { type: String, required: true, trim: true },
  registrationDeadline: { type: Date, required: true },
  category: { type: String, required: true, trim: true },
  tags: { type: [String], default: [] },
  prizePool: { type: Number, default: 0 },
  currency: { type: String, default: 'INR', trim: true },
  registeredCount: { type: Number, default: 0 },
  source: { type: String, required: true, trim: true, enum: ['unstop', 'devfolio'] },
  sourceEventId: { type: String, required: true, trim: true },
  location: { type: String, trim: true },
  startDate: { type: Date },
  endDate: { type: Date },
  eligibility: { type: String, trim: true },
  saveCount: { type: Number, default: 0 },
  // New fields for matching engine
  requiredSkills: { type: [String], default: [] },
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' },
  banner: { type: String, trim: true }
}, { timestamps: true });

// Indexes
eventSchema.index({ registrationDeadline: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ tags: 1 });
eventSchema.index({ source: 1, sourceEventId: 1 }, { unique: true });
eventSchema.index({ title: 'text', description: 'text' }); // Full-text search

module.exports = mongoose.model('Event', eventSchema);
