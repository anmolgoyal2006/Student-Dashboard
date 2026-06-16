
const Event = require('../models/Event');
const SavedEvent = require('../models/SavedEvent');
const { scheduleReminders, cancelReminders } = require('./reminderService');
const { getCachedRecommendations, generateAndCacheRecommendations } = require('./recommendationCache');
const { stripHtml } = require('../utils/helpers');

async function saveEvents(events) {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const event of events) {
    // Strip HTML from description
    event.description = stripHtml(event.description);
    
    // Verify data quality before inserting
    if (!event.title || !event.registrationDeadline || !event.source || !event.sourceEventId) {
      console.warn(`⚠️ Skipping invalid event:`, event);
      skipped++;
      continue;
    }

    try {
      // Check if duplicate
      const exists = await Event.findOne({
        source: event.source,
        sourceEventId: event.sourceEventId
      });

      if (exists) {
        // Update existing
        await Event.updateOne({ _id: exists._id }, event);
        updated++;
      } else {
        // Insert new
        await Event.create(event);
        inserted++;
      }
    } catch (error) {
      console.error(`❌ Error processing event ${event.title}:`, error.message);
      skipped++;
    }
  }

  console.log(`📊 Event processing complete: Inserted ${inserted}, Updated ${updated}, Skipped ${skipped}`);
  return { inserted, updated, skipped };
}

async function getAllEvents(filters = {}, page = 1, limit = 20) {
  const query = {};
  if (filters.source) query.source = filters.source;
  if (filters.category) query.category = filters.category;

  const events = await Event.find(query)
    .sort({ registrationDeadline: 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Event.countDocuments(query);

  return {
    events,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

async function getLatestEvents(limit = 50) {
  return await Event.find().sort({ createdAt: -1 }).limit(limit);
}

async function getTrendingEvents(limit = 20) {
  return await Event.find().sort({ saveCount: -1, registrationDeadline: 1 }).limit(limit);
}

async function getClosingSoonEvents(days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  return await Event.find({ 
    registrationDeadline: { $gte: new Date(), $lte: cutoff } 
  }).sort({ registrationDeadline: 1 });
}

async function getEventById(id) {
  return await Event.findById(id);
}

async function searchEvents(query, limit = 20) {
  return await Event.find(
    { $text: { $search: query } },
    { score: { $meta: 'textScore' } }
  ).sort({ score: { $meta: 'textScore' } }).limit(limit);
}

async function saveEventForUser(userId, eventId, notes = null, reminderDate = null) {
  const existing = await SavedEvent.findOne({ userId, eventId });
  if (existing) {
    return { alreadySaved: true, savedEvent: existing };
  }

  // Get event details for reminder scheduling
  const event = await Event.findById(eventId);
  
  const savedEvent = await SavedEvent.create({
    userId,
    eventId,
    notes,
    reminderDate
  });

  // Increment save count on event
  await Event.findByIdAndUpdate(eventId, { $inc: { saveCount: 1 } });

  // Schedule reminders if event exists
  if (event) {
    await scheduleReminders(userId, event);
  }

  return { alreadySaved: false, savedEvent };
}

async function unsaveEventForUser(userId, eventId) {
  const deleted = await SavedEvent.findOneAndDelete({ userId, eventId });
  if (deleted) {
    // Decrement save count on event
    await Event.findByIdAndUpdate(eventId, { $inc: { saveCount: -1 } });
    // Cancel unsent reminders
    await cancelReminders(userId, eventId);
    return true;
  }
  return false;
}

async function getSavedEventsForUser(userId) {
  const savedEvents = await SavedEvent.find({ userId }).populate('eventId').sort({ createdAt: -1 });
  // Return just the populated events
  return savedEvents.map(se => se.eventId).filter(Boolean);
}

async function getRecommendedEvents(userId, limit = 20) {
  try {
    // First try to get cached recommendations
    const cached = await getCachedRecommendations(userId);
    if (cached && cached.length > 0) {
      return cached.slice(0, limit);
    }

    // If no cache, generate new ones
    return await generateAndCacheRecommendations(userId);
  } catch (error) {
    console.error('[Event Service] Error getting recommended events:', error);
    // Fallback to trending events
    const trending = await getTrendingEvents(limit);
    return trending.map(event => ({ ...event._doc, matchScore: 50, matchReasons: ['Trending in your area'] }));
  }
}

async function detectDuplicates() {
  console.log('🔍 Checking for duplicate events...');
  // Duplicate detection logic can be implemented here
  return { duplicatesFound: 0 };
}

module.exports = { 
  saveEvents, 
  getAllEvents, 
  getLatestEvents, 
  getTrendingEvents, 
  getClosingSoonEvents, 
  getEventById, 
  searchEvents, 
  saveEventForUser, 
  unsaveEventForUser, 
  getSavedEventsForUser, 
  getRecommendedEvents,
  detectDuplicates
};
