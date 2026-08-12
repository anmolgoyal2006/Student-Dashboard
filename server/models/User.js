const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  sid:  { type: String, sparse: true, index: true },
  role: { type: String, enum: ['student', 'teacher'], default: 'student' },
  // Stamped into every JWT and re-checked on each request. Bumping it
  // invalidates every token issued before the bump — this is the only way to
  // revoke a stolen JWT before its 7-day expiry.
  tokenVersion: { type: Number, default: 0 },
  college:  { type: String, default: '' },
  semester: { type: Number, default: 1, min: 1, max: 8 },
  branch:   { type: String, default: '' },
  resetPasswordToken:   { type: String, default: undefined },
  resetPasswordExpires: { type: Date,   default: undefined },
  googleId: { type: String, default: null },
  avatar:   { type: String, default: '' },
  fcmToken: { type: String, default: null },
  // New fields for matching engine
  skills: { type: [String], default: [] },
  interests: { type: [String], default: [] },
  cgpa: { type: Number, default: 0, min: 0, max: 10 },
  state: { type: String, default: '' }
}, { timestamps: true });

userSchema.pre('save', function (next) {
  if (this.sid === '') this.sid = null;
  if (this.googleId === '') this.googleId = null;
  next();
});

userSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update?.$set?.sid === '') update.$set.sid = null;
  if (update?.sid === '') update.sid = null;
  next();
});

module.exports = mongoose.model('User', userSchema);
