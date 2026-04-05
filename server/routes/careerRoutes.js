const express  = require('express');
const router   = express.Router();
const { getCareer, updateCareer, updateTopic } = require('../controllers/careerController');
const { getCareerPlan }                        = require('../controllers/careerPlanController');
const { protect }                              = require('../middleware/authMiddleware');

router.use(protect);

router.get('/plan',               getCareerPlan);   // ← MUST be first
router.get('/',                   getCareer);
router.put('/',                   updateCareer);
router.patch('/topic/:topicName', updateTopic);

module.exports = router;