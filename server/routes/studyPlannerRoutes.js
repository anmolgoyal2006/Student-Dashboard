const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { generatePlan } = require('../controllers/studyPlannerController');

router.post('/generate-study-plan', protect, validate([
  body('availableHoursPerDay').optional().isFloat({ min: 0 }).withMessage('availableHoursPerDay must be a positive number.'),
]), generatePlan);

module.exports = router;
