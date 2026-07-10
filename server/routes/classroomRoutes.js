const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const {
  auth,
  callback,
  status,
  disconnect,
  getCourses,
  listCourses,
  getAssignments,
  sync,
} = require('../controllers/classroomController');

router.get('/auth', protect, auth);
router.get('/callback', callback);
router.get('/status', protect, status);
router.delete('/disconnect', protect, disconnect);
router.get('/courses', protect, getCourses);
router.get('/courses/available', protect, listCourses);
router.get('/assignments', protect, getAssignments);
router.post('/sync', protect, validate([
  body('courseIds').optional().isArray().withMessage('courseIds must be an array.'),
  body('courseIds.*').optional().isString(),
]), sync);

module.exports = router;
