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

  // Persisted list of Google Classroom courseId strings the user explicitly
  // chose to sync. Empty array = user has never synced or cleared all courses.
  // The background cron reads this so it only re-syncs courses the user
  // actually wants — preventing previously de-selected courses from
  // reappearing automatically every 6 hours.
  syncedCourseIds: { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('GoogleIntegration', googleIntegrationSchema);
