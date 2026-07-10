const express = require('express');
const router  = express.Router();
const { body, param } = require('express-validator');
const { getSubjects, addSubject, updateSubject, deleteSubject } = require('../controllers/timetableController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');

router.use(protect);

const subjectFields = [
  body('code').optional().isString(),
  body('instructor').optional().isString(),
  body('credits').optional().isFloat({ min: 1, max: 6 }).withMessage('Credits must be between 1 and 6.'),
  body('schedule').optional().isArray(),
  body('schedule.*.day').optional().isIn(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']),
  body('schedule.*.startTime').optional().isString(),
  body('schedule.*.endTime').optional().isString(),
  body('schedule.*.room').optional().isString(),
];

router.get('/', getSubjects);

router.post('/', validate([
  body('name').trim().notEmpty().withMessage('Subject name is required.'),
  ...subjectFields,
]), addSubject);

router.put('/:id', validate([
  param('id').isMongoId(),
  body('name').optional().trim().notEmpty(),
  ...subjectFields,
]), updateSubject);

router.delete('/:id', validate([param('id').isMongoId()]), deleteSubject);

module.exports = router;
