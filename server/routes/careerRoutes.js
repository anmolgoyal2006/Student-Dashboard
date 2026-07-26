const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
// Bare multer() has no size cap and buffers into RAM. uploadResume also checks
// size, but only after the full file is already in memory — too late to help.
const upload   = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/pdf' ||
      file.mimetype.startsWith('image/') ||
      /\.(pdf|png|jpe?g)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only PDF and image files (PNG, JPG) are allowed.'), ok);
  },
});
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');

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
  getCompanyQuestions,
} = require('../controllers/leetcodeController');
const { protect }                              = require('../middleware/authMiddleware');
const { aiLimiter }                            = require('../middleware/rateLimitMiddleware');

router.use(protect);

router.get('/plan',               getCareerPlan);   // ← MUST be first
router.post('/dsa/coach',         aiLimiter, validate([body('refresh').optional().isBoolean()]), getDsaCoach);
router.post('/dsa/topic-guide',   aiLimiter, validate([body('topic').notEmpty().isString()]), getTopicGuide);
router.post('/dsa/log-practice',  aiLimiter, validate([body('text').notEmpty().isString()]), logPractice);
router.post('/dsa/hint',          aiLimiter, validate([
  body('topic').notEmpty().isString(),
  body('problemTitle').notEmpty().isString(),
  body('attempt').optional().isString(),
]), getHint);

router.put('/leetcode', validate([
  body('username').trim().notEmpty().withMessage('LeetCode username is required.'),
]), linkLeetcode);
router.delete('/leetcode',        unlinkLeetcode);
router.post('/leetcode/sync', validate([
  body('username').optional().isString().trim(),
]), syncLeetcode);
router.get('/leetcode/company-questions', getCompanyQuestions);
router.get('/',                   getCareer);

router.put('/', validate([
  body('targetCompany').optional().isIn([
    'Amazon', 'Microsoft', 'Google', 'Meta', 'Apple', 'Netflix', 'Flipkart',
    'Adobe', 'Uber', 'LinkedIn', 'Salesforce', 'Oracle', 'Infosys', 'TCS',
    'Wipro', 'HCL Technologies', 'Other',
  ]),
  body('targetRole').optional().isString(),
  body('skills').optional().isArray(),
  body('problemsSolved').optional().isInt({ min: 0 }),
  body('leetcodeUsername').optional().isString(),
  body('dsaTopics').optional().isArray(),
  body('dsaTopics.*.name').optional().isString(),
  body('dsaTopics.*.problems').optional().isInt({ min: 0 }),
  body('dsaTopics.*.completed').optional().isBoolean(),
]), updateCareer);

router.patch('/topic/:topicName', validate([
  body('completed').optional().isBoolean(),
  body('problems').optional().isInt({ min: 0 }),
]), updateTopic);

router.post('/analyze-resume', aiLimiter, validate([
  body('resumeText').notEmpty().isString().withMessage('Resume text is required.'),
]), analyzeResume);
router.post('/mock-questions', aiLimiter, validate([
  body('topic').notEmpty().isString().withMessage('Topic is required.'),
]), generateMockQuestions);
router.post('/evaluate-answer', aiLimiter, validate([
  body('question').notEmpty().isString(),
  body('userAnswer').notEmpty().isString(),
  body('topic').optional().isString(),
]), evaluateInterviewAnswer);
router.post('/upload-resume',    upload.single('file'), uploadResume);
router.patch('/active-interview/index', validate([
  // Preserves existing semantics exactly (controller currently checks
  // typeof index !== 'number') — isNumeric() rather than isInt() so this
  // doesn't introduce a new, stricter constraint.
  body('index').isNumeric().withMessage('Index must be a number.'),
]), updateActiveIndex);
router.delete('/active-interview',      resetActiveInterview);

module.exports = router;