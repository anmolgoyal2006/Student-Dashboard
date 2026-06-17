
const StudentRecommendation = require('../models/StudentRecommendation');
const Event = require('../models/Event');
const User = require('../models/User');
const { getTopMatches } = require('./matchingEngine');

// TTL in milliseconds (6 hours)
const CACHE_TTL = 6 * 60 * 60 * 1000;

async function getCachedRecommendations(userId) {
  try {
    const cached = await StudentRecommendation.find({
      userId,
      expiresAt: { $gt: new Date() }
    }).populate('eventId').sort({ matchScore: -1 });

    if (cached.length > 0) {
      return cached.map(rec => ({
        ...rec.eventId._doc,
        matchScore: rec.matchScore,
        matchReasons: rec.matchReasons
      }));
    }
    return null;
  } catch (err) {
    console.error('[Recommendation Cache] Error getting cached recommendations:', err);
    return null;
  }
}

async function cacheRecommendations(userId, recommendations) {
  try {
    console.log(`[Recommendation Cache] Caching ${recommendations.length} recommendations for user ${userId}`);
    console.log('[Recommendation Cache] Sample rec:', recommendations[0]);
    
    // Delete existing recommendations for user
    await StudentRecommendation.deleteMany({ userId });

    // Create new recommendations - filter out any without _id
    const validRecs = recommendations.filter(rec => rec._id);
    
    const newRecs = validRecs.map(rec => ({
      userId,
      eventId: rec._id,
      matchScore: rec.matchScore.score,
      matchReasons: rec.matchScore.reasons,
      expiresAt: new Date(Date.now() + CACHE_TTL)
    }));

    if (newRecs.length > 0) {
      await StudentRecommendation.insertMany(newRecs);
      console.log(`[Recommendation Cache] Cached ${newRecs.length} recommendations for user ${userId}`);
    } else {
      console.warn(`[Recommendation Cache] No valid recommendations to cache for user ${userId}`);
    }
  } catch (err) {
    console.error('[Recommendation Cache] Error caching recommendations:', err);
  }
}

async function generateAndCacheRecommendations(userId) {
  try {
    const [user, events] = await Promise.all([
      User.findById(userId),
      Event.find({ registrationDeadline: { $gt: new Date() } })
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    const topMatches = getTopMatches(user, events);
    await cacheRecommendations(userId, topMatches);
    // Normalize matchScore from {score, reasons} to flat fields, matching the cached response shape
    return topMatches.map(match => ({
      ...match,
      matchScore: match.matchScore.score,
      matchReasons: match.matchScore.reasons
    }));
  } catch (err) {
    console.error('[Recommendation Cache] Error generating recommendations:', err);
    throw err;
  }
}

module.exports = {
  getCachedRecommendations,
  cacheRecommendations,
  generateAndCacheRecommendations,
  CACHE_TTL
};

