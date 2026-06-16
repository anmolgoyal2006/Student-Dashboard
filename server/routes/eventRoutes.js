
const express = require('express');
const router = express.Router();
const { getAllEvents } = require('../services/eventService');

// Get all hackathon events, with optional filters
router.get('/', async (req, res) => {
  try {
    const events = await getAllEvents(req.query);
    res.status(200).json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    console.error('[Events API] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events'
    });
  }
});

module.exports = router;
