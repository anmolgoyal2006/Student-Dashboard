
const mongoose = require('mongoose');

const studentRecommendationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  matchScore: { type: Number, required: true, min: 0, max: 100 },
  matchReasons: { type: [String], default: [] },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

studentRecommendationSchema.index({ userId: 1, matchScore: -1 });
studentRecommendationSchema.index({ userId: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('StudentRecommendation', studentRecommendationSchema);

