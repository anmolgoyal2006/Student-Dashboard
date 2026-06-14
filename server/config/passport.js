require('dotenv').config();  
const passport      = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt           = require('jsonwebtoken');
const User          = require('../models/User');

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_AUTH_CLIENT_ID,
  clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET,
  callbackURL: process.env.NODE_ENV === 'production'
  ? 'https://student-dashboard-irm9.onrender.com/auth/google/callback'
  : 'http://localhost:5000/auth/google/callback'
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const email  = profile.emails[0].value;
    const name   = profile.displayName;
    const avatar = profile.photos?.[0]?.value || '';

    let user = await User.findOne({ email });

    if (!user) {
      // Try to find by googleId in case email lookup missed it
      user = await User.findOne({ googleId: profile.id });
    }

    if (!user) {
      // Create new user — no password required for Google users
      user = await User.create({
        name,
        email,
        avatar,
        googleId: profile.id,
        sid: undefined,   // explicitly unset so sparse index ignores it
        password: 'GOOGLE_AUTH_' + profile.id,
      });
    } else {
      // Existing user — link Google account if not already linked
      let changed = false;
      if (!user.googleId) { user.googleId = profile.id; changed = true; }
      if (!user.avatar)   { user.avatar   = avatar;     changed = true; }
      if (changed) await user.save();
    }

    return done(null, user);
  } catch (err) {
    // If duplicate key on sid, try to find the existing user and return them
    if (err.code === 11000) {
      try {
        const email = profile.emails[0].value;
        const user  = await User.findOne({ email });
        if (user) return done(null, user);
      } catch (_) {}
    }
    return done(err, null);
  }
}));

module.exports = passport;