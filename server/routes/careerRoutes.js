const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const upload   = multer();

const {
  getCareer,
  updateCareer,
  updateTopic,
  analyzeResume,
  generateMockQuestions,
  evaluateInterviewAnswer,
  uploadResume
} = require('../controllers/careerController');
const { getCareerPlan }                        = require('../controllers/careerPlanController');
const { protect }                              = require('../middleware/authMiddleware');

router.use(protect);

router.get('/plan',               getCareerPlan);   // ← MUST be first
router.get('/',                   getCareer);
router.put('/',                   updateCareer);
router.patch('/topic/:topicName', updateTopic);

router.post('/analyze-resume',   analyzeResume);
router.post('/mock-questions',   generateMockQuestions);
router.post('/evaluate-answer',  evaluateInterviewAnswer);
router.post('/upload-resume',    upload.single('file'), uploadResume);

module.exports = router;