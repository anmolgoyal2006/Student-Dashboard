const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { TTLCache } = require('../utils/ttlCache');

// A JWT is valid for 7 days and, on its own, cannot be withdrawn — so a token
// copied off a device keeps working even after logout or a password reset.
// Every token carries the user's tokenVersion; bumping the stored value
// invalidates all tokens issued before the bump.
//
// Checking that means a DB read per request, which is too expensive on every
// authenticated call, so versions are cached in-process for 30s. The cost is a
// revocation window of up to 30s (plus, on multi-instance deploys, per
// instance) — acceptable for logout, and password reset additionally rotates
// the password hash, so the stolen token cannot be used to change credentials.
const versionCache = new TTLCache({ ttlMs: 30 * 1000, maxEntries: 10000 });

async function currentTokenVersion(userId) {
  const cached = versionCache.get(userId);
  if (cached !== undefined) return cached;

  const user = await User.findById(userId).select('tokenVersion').lean();
  if (!user) return null;

  const version = user.tokenVersion || 0;
  versionCache.set(userId, version);
  return version;
}

function invalidateUserTokens(userId) {
  versionCache.store.delete(String(userId));
}

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }

  const userId = decoded.id || decoded._id || decoded.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }

  try {
    const expected = await currentTokenVersion(String(userId));

    // Deleted user — the token is signed correctly but no longer maps to anyone.
    if (expected === null) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    // Tokens minted before tokenVersion existed have no claim; treat as 0 so
    // existing sessions keep working until their natural expiry.
    if ((decoded.tokenVersion || 0) !== expected) {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
  } catch (err) {
    // A DB blip must not silently downgrade auth to "allow".
    console.error('[auth] tokenVersion check failed:', err.message);
    return res.status(503).json({ message: 'Authentication temporarily unavailable.' });
  }

  // Normalize: always expose both .id and ._id
  req.user = { ...decoded, _id: userId };
  next();
};

module.exports = { protect, invalidateUserTokens, versionCache };
