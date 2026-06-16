
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getAllEvents,
  getLatestEvents,
  getTrendingEvents,
  getClosingSoonEvents,
  getEventById,
  searchEvents,
  saveEventForUser,
  unsaveEventForUser,
  getSavedEventsForUser,
  getRecommendedEvents
} = require('../services/eventService');

// GET /api/opportunities - All events (paginated)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, source, category } = req.query;
    const result = await getAllEvents({ source, category }, parseInt(page), parseInt(limit));
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[Opportunities API] Error fetching events:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events'
    });
  }
});

// GET /api/opportunities/latest - Latest 50 events
router.get('/latest', async (req, res) => {
  try {
    const events = await getLatestEvents();
    res.status(200).json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    console.error('[Opportunities API] Error fetching latest events:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest events'
    });
  }
});

// GET /api/opportunities/trending - Most saved events
router.get('/trending', async (req, res) => {
  try {
    const events = await getTrendingEvents();
    res.status(200).json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    console.error('[Opportunities API] Error fetching trending events:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trending events'
    });
  }
});

// GET /api/opportunities/closing-soon - Deadline &lt; 7 days
router.get('/closing-soon', async (req, res) => {
  try {
    const events = await getClosingSoonEvents();
    res.status(200).json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    console.error('[Opportunities API] Error fetching closing soon events:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch closing soon events'
    });
  }
});

// GET /api/opportunities/recommended - AI matched for user (protected)
router.get('/recommended', protect, async (req, res) => {
  try {
    const events = await getRecommendedEvents(req.user._id);
    res.status(200).json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    console.error('[Opportunities API] Error fetching recommended events:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recommended events'
    });
  }
});

// GET /api/opportunities/search - Full-text search
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query (q) is required'
      });
    }
    const events = await searchEvents(q);
    res.status(200).json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    console.error('[Opportunities API] Error searching events:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to search events'
    });
  }
});

// GET /api/opportunities/saved - User's saved events (protected)
router.get('/saved', protect, async (req, res) => {
  try {
    const events = await getSavedEventsForUser(req.user._id);
    res.status(200).json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    console.error('[Opportunities API] Error fetching saved events:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch saved events'
    });
  }
});

// POST /api/opportunities/:id/save - Save event (protected)
router.post('/:id/save', protect, async (req, res) => {
  try {
    const { notes, reminderDate } = req.body;
    const result = await saveEventForUser(req.user._id, req.params.id, notes, reminderDate);
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[Opportunities API] Error saving event:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to save event'
    });
  }
});

// DELETE /api/opportunities/:id/save - Unsave event (protected)
router.delete('/:id/save', protect, async (req, res) => {
  try {
    const deleted = await unsaveEventForUser(req.user._id, req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Saved event not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Event unsaved successfully'
    });
  } catch (error) {
    console.error('[Opportunities API] Error unsaving event:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to unsave event'
    });
  }
});

// GET /api/opportunities/:id - Single event details
router.get('/:id', async (req, res) => {
  try {
    const event = await getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    res.status(200).json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('[Opportunities API] Error fetching event details:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event details'
    });
  }
});

module.exports = router;

