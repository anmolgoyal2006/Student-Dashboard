const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const aiService = require('../services/aiRecommendationService');

router.get('/', protect, async (req, res) => {
  try {
    const suggestions = await aiService.getRecommendations(req.user.id);
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
