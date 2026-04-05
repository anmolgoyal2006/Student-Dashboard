const express = require('express');
const router  = express.Router();
const { handleCommand } = require('../controllers/aiCommandController');
const { protect }       = require('../middleware/authMiddleware');

router.use(protect);
router.post('/', handleCommand);

module.exports = router;