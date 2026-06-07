const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { generatePlan } = require('../controllers/studyPlannerController');

router.post('/generate-study-plan', protect, generatePlan);

module.exports = router;
