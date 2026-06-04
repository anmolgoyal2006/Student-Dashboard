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
  uploadResume,
  updateActiveIndex,
  resetActiveInterview
} = require('../controllers/careerController');
const { getCareerPlan }                        = require('../controllers/careerPlanController');
const {
  getDsaCoach,
  getTopicGuide,
  logPractice,
  getHint,
} = require('../controllers/dsaCoachController');
const {
  linkLeetcode,
  unlinkLeetcode,
  syncLeetcode,
} = require('../controllers/leetcodeController');
const { protect }                              = require('../middleware/authMiddleware');

router.use(protect);

router.get('/plan',               getCareerPlan);   // ← MUST be first
router.post('/dsa/coach',         getDsaCoach);
router.post('/dsa/topic-guide',   getTopicGuide);
router.post('/dsa/log-practice',  logPractice);
router.post('/dsa/hint',          getHint);
router.put('/leetcode',           linkLeetcode);
router.delete('/leetcode',        unlinkLeetcode);
router.post('/leetcode/sync',     syncLeetcode);
router.get('/',                   getCareer);
router.put('/',                   updateCareer);
router.patch('/topic/:topicName', updateTopic);

router.post('/analyze-resume',   analyzeResume);
router.post('/mock-questions',   generateMockQuestions);
router.post('/evaluate-answer',  evaluateInterviewAnswer);
router.post('/upload-resume',    upload.single('file'), uploadResume);
router.patch('/active-interview/index', updateActiveIndex);
router.delete('/active-interview',      resetActiveInterview);

module.exports = router;