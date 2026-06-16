const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  sid:  { type: String, sparse: true },
  role: { type: String, enum: ['student', 'teacher'], default: 'student' },
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
  cgpa: { type: Number, default: 0, min: 0, max: 10 }
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
