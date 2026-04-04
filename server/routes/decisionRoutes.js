const express  = require('express');
const router   = express.Router();
const { protect } = require('../middleware/authMiddleware');
const decisionService = require('../services/decisionService');

router.get('/today-plan', protect, async (req, res) => {
  try {
    const plan = await decisionService.getTodayPlan(req.user.id);
    res.json(plan);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;