
const Event = require('../models/Event');
const SavedEvent = require('../models/SavedEvent');
const { scheduleReminders, cancelReminders } = require('./reminderService');
const { getCachedRecommendations, generateAndCacheRecommendations } = require('./recommendationCache');
const { stripHtml } = require('../utils/helpers');
const stringSimilarity = require('string-similarity');

async function saveEvents(events) {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const ops = [];

  // First, delete expired events from the database
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiredEvents = await Event.deleteMany({
    registrationDeadline: { $lt: today }
  });
  console.log(`🗑️ Deleted ${expiredEvents.deletedCount} expired events`);

  for (const event of events) {
    // Strip HTML from description
    event.description = stripHtml(event.description);

    // Verify data quality before inserting
    if (!event.title || !event.registrationDeadline || !event.source || !event.sourceEventId) {
      console.warn(`⚠️ Skipping invalid event:`, event);
      skipped++;
      continue;
    }

    // Upsert keyed on (source, sourceEventId): update when it already exists,
    // insert otherwise. Collapses the previous per-event findOne + update/create
    // (~2 round trips each) into a single batched bulkWrite below.
    ops.push({
      updateOne: {
        filter: { source: event.source, sourceEventId: event.sourceEventId },
        update: { $set: event },
        upsert: true,
      },
    });
  }

  if (ops.length > 0) {
    try {
      // Chunk to keep individual bulkWrite payloads bounded on large runs.
      const CHUNK = 500;
      for (let i = 0; i < ops.length; i += CHUNK) {
        const result = await Event.bulkWrite(ops.slice(i, i + CHUNK), { ordered: false });
        inserted += result.upsertedCount || 0;
        updated  += result.matchedCount || 0;
      }
    } catch (error) {
      console.error('❌ Error bulk-writing events:', error.message);
      // A bulk error may still have written some docs; surface it but don't crash the run.
      skipped += ops.length;
    }
  }

  console.log(`📊 Event processing complete: Inserted ${inserted}, Updated ${updated}, Skipped ${skipped}`);
  return { inserted, updated, skipped };
}

async function getAllEvents(filters = {}, page = 1, limit = 20) {
  const query = {};
  if (filters.source) query.source = filters.source;
  if (filters.category) query.category = filters.category;
  if (filters.difficulty) query.difficulty = filters.difficulty;
  
  // Handle state-related filters
  if (filters.state) {
    // Manual state filter: check state, location, description, OR no explicit location info (empty state and location)
    query.$or = [
      { state: { $regex: new RegExp(filters.state, 'i') } },
      { location: { $regex: new RegExp(filters.state, 'i') } },
      { description: { $regex: new RegExp(filters.state, 'i') } },
      { 
        $and: [
          { $or: [{ state: '' }, { state: { $exists: false } }] },
          { $or: [{ location: '' }, { location: { $exists: false } }] }
        ]
      }
    ];
  } else if (filters.userState) {
    // User profile state filter: check state/location/description, or allow events with no explicit location info
    query.$or = [
      { state: { $regex: new RegExp(filters.userState, 'i') } },
      { location: { $regex: new RegExp(filters.userState, 'i') } },
      { description: { $regex: new RegExp(filters.userState, 'i') } },
      { 
        $and: [
          { $or: [{ state: '' }, { state: { $exists: false } }] },
          { $or: [{ location: '' }, { location: { $exists: false } }] }
        ]
      }
    ];
  }
  
  // Date range filter
  if (filters.startDate || filters.endDate) {
    query.registrationDeadline = {};
    if (filters.startDate) {
      query.registrationDeadline.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      query.registrationDeadline.$lte = endDate;
    }
  }
  
  // Prize range filter
  if (filters.minPrize !== undefined || filters.maxPrize !== undefined) {
    query.prizePool = {};
    if (filters.minPrize !== undefined) {
      query.prizePool.$gte = parseFloat(filters.minPrize);
    }
    if (filters.maxPrize !== undefined) {
      query.prizePool.$lte = parseFloat(filters.maxPrize);
    }
  }

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

async function getLatestEvents(limit = 50, userState = '') {
  let query = {};
  if (userState) {
    query.$or = [
      { state: { $regex: new RegExp(userState, 'i') } },
      { location: { $regex: new RegExp(userState, 'i') } },
      { description: { $regex: new RegExp(userState, 'i') } },
      { 
        $and: [
          { $or: [{ state: '' }, { state: { $exists: false } }] },
          { $or: [{ location: '' }, { location: { $exists: false } }] }
        ]
      }
    ];
  }
  return await Event.find(query).sort({ createdAt: -1 }).limit(limit);
}

async function getTrendingEvents(limit = 20, userState = '') {
  let query = {};
  if (userState) {
    query.$or = [
      { state: { $regex: new RegExp(userState, 'i') } },
      { location: { $regex: new RegExp(userState, 'i') } },
      { description: { $regex: new RegExp(userState, 'i') } },
      { 
        $and: [
          { $or: [{ state: '' }, { state: { $exists: false } }] },
          { $or: [{ location: '' }, { location: { $exists: false } }] }
        ]
      }
    ];
  }
  return await Event.find(query).sort({ saveCount: -1, registrationDeadline: 1 }).limit(limit);
}

async function getClosingSoonEvents(days = 7, userState = '') {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  let query = { 
    registrationDeadline: { $gte: new Date(), $lte: cutoff } 
  };
  if (userState) {
    query.$and = [
      query,
      {
        $or: [
          { state: { $regex: new RegExp(userState, 'i') } },
          { location: { $regex: new RegExp(userState, 'i') } },
          { description: { $regex: new RegExp(userState, 'i') } },
          { 
            $and: [
              { $or: [{ state: '' }, { state: { $exists: false } }] },
              { $or: [{ location: '' }, { location: { $exists: false } }] }
            ]
          }
        ]
      }
    ];
  }
  return await Event.find(query).sort({ registrationDeadline: 1 });
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
  const User = require('../models/User');
  const user = await User.findById(userId).select('state');
  const userState = user?.state || '';
  
  const savedEvents = await SavedEvent.find({ userId }).populate('eventId').sort({ createdAt: -1 });
  
  // Return just the populated events, filtered by user's state
  return savedEvents.map(se => se.eventId).filter(Boolean).filter(event => {
    if (!userState) return true;
    const eventState = event.state || '';
    const eventLocation = event.location || '';
    const eventDesc = event.description || '';
    return (
      eventState.toLowerCase().includes(userState.toLowerCase()) ||
      eventLocation.toLowerCase().includes(userState.toLowerCase()) ||
      eventDesc.toLowerCase().includes(userState.toLowerCase()) ||
      (!eventState && !eventLocation)
    );
  });
}

async function getRecommendedEvents(userId, limit = 20) {
  try {
    // Get user to check their state
    const User = require('../models/User');
    const user = await User.findById(userId).select('state');
    const userState = user?.state || '';

    // First try to get cached recommendations
    const cached = await getCachedRecommendations(userId);
    if (cached && cached.length > 0) {
      // Filter cached events by user's state
      const filtered = cached.filter(event => {
        if (!userState) return true;
        const eventState = event.state || '';
        const eventLocation = event.location || '';
        const eventDesc = event.description || '';
        return (
          eventState.toLowerCase().includes(userState.toLowerCase()) ||
          eventLocation.toLowerCase().includes(userState.toLowerCase()) ||
          eventDesc.toLowerCase().includes(userState.toLowerCase()) ||
          (!eventState && !eventLocation)
        );
      });
      return filtered.slice(0, limit);
    }

    // If no cache, generate new ones
    const recommendations = await generateAndCacheRecommendations(userId);
    // Filter recommendations by user's state
    const filtered = recommendations.filter(event => {
      if (!userState) return true;
      const eventState = event.state || '';
      const eventLocation = event.location || '';
      const eventDesc = event.description || '';
      return (
        eventState.toLowerCase().includes(userState.toLowerCase()) ||
        eventLocation.toLowerCase().includes(userState.toLowerCase()) ||
        eventDesc.toLowerCase().includes(userState.toLowerCase()) ||
        (!eventState && !eventLocation)
      );
    });
    return filtered.slice(0, limit);
  } catch (error) {
    console.error('[Event Service] Error getting recommended events:', error);
    // Fallback to trending events
    const User = require('../models/User');
    const user = await User.findById(userId).select('state');
    const userState = user?.state || '';
    let trending = await getTrendingEvents(limit * 2); // Get more to filter
    return trending.slice(0, limit).map(event => ({ ...event._doc, matchScore: 50, matchReasons: ['Trending in your area'] }));
  }
}

async function detectDuplicates() {
  console.log('🔍 Checking for duplicate events...');
  const allEvents = await Event.find().sort({ createdAt: -1 });
  
  const duplicates = [];
  const processedEventIds = new Set();
  
  // Check all pairs of events for duplicates
  for (let i = 0; i < allEvents.length; i++) {
    const eventA = allEvents[i];
    if (processedEventIds.has(eventA._id.toString())) continue;
    
    for (let j = i + 1; j < allEvents.length; j++) {
      const eventB = allEvents[j];
      if (processedEventIds.has(eventB._id.toString())) continue;
      
      // Check if they're potential duplicates
      let isDuplicate = false;
      let duplicateReason = '';
      
      // First check: same source and sourceEventId (exact duplicate)
      if (eventA.source === eventB.source && eventA.sourceEventId === eventB.sourceEventId) {
        isDuplicate = true;
        duplicateReason = 'Exact match (same source and sourceEventId)';
      } else {
        // Check title similarity
        const titleSimilarity = stringSimilarity.compareTwoStrings(
          eventA.title.toLowerCase(), 
          eventB.title.toLowerCase()
        );
        
        // Check description similarity if descriptions exist
        let descSimilarity = 0;
        if (eventA.description && eventB.description) {
          descSimilarity = stringSimilarity.compareTwoStrings(
            stripHtml(eventA.description).toLowerCase(), 
            stripHtml(eventB.description).toLowerCase()
          );
        }
        
        // Check if registration dates are close
        const dateDiff = Math.abs(
          new Date(eventA.registrationDeadline) - new Date(eventB.registrationDeadline)
        );
        const daysDiff = dateDiff / (1000 * 60 * 60 * 24);
        
        // If titles are very similar (>0.85), or titles and descriptions are both moderately similar (>0.7)
        if (
          titleSimilarity > 0.85 || 
          (titleSimilarity > 0.7 && descSimilarity > 0.7 && daysDiff < 30)
        ) {
          isDuplicate = true;
          duplicateReason = `Fuzzy match (title similarity: ${titleSimilarity.toFixed(2)}${descSimilarity > 0 ? `, description similarity: ${descSimilarity.toFixed(2)}` : ''})`;
        }
      }
      
      if (isDuplicate) {
        duplicates.push({
          eventA: {
            id: eventA._id,
            title: eventA.title,
            source: eventA.source,
            sourceEventId: eventA.sourceEventId
          },
          eventB: {
            id: eventB._id,
            title: eventB.title,
            source: eventB.source,
            sourceEventId: eventB.sourceEventId
          },
          reason: duplicateReason
        });
        
        processedEventIds.add(eventB._id.toString());
      }
    }
  }
  
  console.log(`🔍 Found ${duplicates.length} potential duplicate(s)!`);
  if (duplicates.length > 0) {
    console.log('📋 Duplicates:', duplicates);
  }
  
  return { 
    duplicatesFound: duplicates.length, 
    duplicates 
  };
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
