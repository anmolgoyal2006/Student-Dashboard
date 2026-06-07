const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { checkAcademicRisks, getAcademicRisks } = require('../services/riskIntelligence');

router.get('/risks', protect, async (req, res) => {
  try {
    const alerts = await getAcademicRisks(req.user.id);
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch risks.' });
  }
});

router.post('/risks/check', protect, async (req, res) => {
  try {
    const alerts = await checkAcademicRisks(req.user.id);
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ message: 'Failed to check risks.' });
  }
});

module.exports = router;
