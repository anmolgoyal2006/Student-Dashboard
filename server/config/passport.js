require('dotenv').config();  
const passport      = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt           = require('jsonwebtoken');
const User          = require('../models/User');

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
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
      // Create new user — no password required for Google users
      user = await User.create({
        name,
        email,
        avatar,
        googleId: profile.id,
        password: 'GOOGLE_AUTH_' + profile.id, // placeholder — never used for login
      });
    } else if (!user.googleId) {
      // Existing email user — link Google account
      user.googleId = profile.id;
      user.avatar   = user.avatar || avatar;
      await user.save();
    }

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

module.exports = passport;