const express = require('express');
const router  = express.Router();
const { body, param } = require('express-validator');
const {
  getTasks, getTask, createTask, updateTask, deleteTask, toggleStatus
} = require('../controllers/taskController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');

router.use(protect);

const taskFields = [
  body('subject').optional().isString(),
  body('description').optional().isString(),
  body('dueTime').optional().isString(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('status').optional().isIn(['pending', 'in-progress', 'completed']),
  body('type').optional().isIn(['assignment', 'exam', 'project', 'revision', 'other']),
];

router.get('/',           getTasks);
router.get('/:id',        validate([param('id').isMongoId()]), getTask);

router.post('/', validate([
  body('title').trim().notEmpty().withMessage('Title and due date are required'),
  body('dueDate').notEmpty().isISO8601().withMessage('Title and due date are required'),
  ...taskFields,
]), createTask);

router.put('/:id', validate([
  param('id').isMongoId(),
  body('title').optional().trim().notEmpty(),
  body('dueDate').optional().isISO8601(),
  ...taskFields,
]), updateTask);

router.delete('/:id', validate([param('id').isMongoId()]), deleteTask);
router.patch('/:id/toggle', validate([param('id').isMongoId()]), toggleStatus);

module.exports = router;