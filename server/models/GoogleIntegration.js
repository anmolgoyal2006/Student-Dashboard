const mongoose = require('mongoose');

const googleIntegrationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  email: { type: String, required: true },
  googleId: { type: String, required: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String },
  tokenExpiry: { type: Date },
  connectedAt: { type: Date, default: Date.now },
  lastSync: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('GoogleIntegration', googleIntegrationSchema);
