const express     = require('express');
const router      = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { processCommand } = require('../controllers/aiCommandController');

router.post('/', protect, processCommand);

module.exports = router;