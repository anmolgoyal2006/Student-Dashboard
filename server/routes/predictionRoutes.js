const express    = require('express');
const router     = express.Router();
const { getPredict, getAIAnalysis } = require('../controllers/predictionController');
const { protect }    = require('../middleware/authMiddleware');

router.use(protect);
router.get('/', getPredict);
router.get('/ai-analysis', getAIAnalysis);

module.exports = router;