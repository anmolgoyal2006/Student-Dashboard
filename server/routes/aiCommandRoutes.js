const express = require('express');
const router  = express.Router();
const { body } = require('express-validator');
const { handleCommand } = require('../controllers/aiCommandController');
const { protect }       = require('../middleware/authMiddleware');
const { aiLimiter }     = require('../middleware/rateLimitMiddleware');
const { validate }      = require('../middleware/validate');

router.use(protect);
// Note: message/text presence is intentionally left to the controller's own
// check — it accepts EITHER field (message || text), which doesn't map
// cleanly onto a single-field validator chain without inventing a new rule.
router.post('/', aiLimiter, validate([
  body('history').optional().isArray(),
]), handleCommand);

module.exports = router;