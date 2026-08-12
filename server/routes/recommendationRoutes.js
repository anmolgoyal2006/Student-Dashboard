const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const aiService = require('../services/aiRecommendationService');

router.get('/', protect, async (req, res) => {
  try {
    // Non-blocking: if recommendations aren't cached yet, kick off generation
    // in the background and return an empty array immediately so the UI loads
    // fast. The client re-polls after ~8 s and gets the real result on the
    // second call (which hits the now-warm cache).
    const result = await aiService.getRecommendationsNonBlocking(req.user.id);
    res.json({ suggestions: result.suggestions, generating: result.generating });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
