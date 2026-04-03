const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  college:  { type: String, default: '' },
  semester: { type: Number, default: 1, min: 1, max: 8 },
  branch:   { type: String, default: '' },
  resetPasswordToken:   { type: String, default: undefined },
  resetPasswordExpires: { type: Date,   default: undefined },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
