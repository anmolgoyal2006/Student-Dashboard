const express    = require('express');
const router     = express.Router();
const { getPredict } = require('../controllers/predictionController');
const { protect }    = require('../middleware/authMiddleware');

router.use(protect);
router.get('/', getPredict);

module.exports = router;