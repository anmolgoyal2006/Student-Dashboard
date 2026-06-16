
const mongoose = require('mongoose');

const savedEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  notes: { type: String, trim: true },
  reminderDate: { type: Date }
}, { timestamps: true });

savedEventSchema.index({ userId: 1, eventId: 1 }, { unique: true });
savedEventSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SavedEvent', savedEventSchema);

