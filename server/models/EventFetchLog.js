
const mongoose = require('mongoose');

const eventFetchLogSchema = new mongoose.Schema({
  collectorName: { type: String, required: true, trim: true, enum: ['unstop', 'devfolio'] },
  status: { type: String, required: true, trim: true, enum: ['success', 'failed', 'partial'] },
  eventCount: { type: Number, default: 0 },
  errorMessage: { type: String, trim: true },
  duration: { type: Number }, // in milliseconds
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
}, { timestamps: true });

eventFetchLogSchema.index({ collectorName: 1, startedAt: -1 });

module.exports = mongoose.model('EventFetchLog', eventFetchLogSchema);

