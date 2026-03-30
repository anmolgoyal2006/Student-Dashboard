const express = require('express');
const router  = express.Router();
const {
  getTasks, getTask, createTask, updateTask, deleteTask, toggleStatus
} = require('../controllers/taskController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/',           getTasks);
router.get('/:id',        getTask);
router.post('/',          createTask);
router.put('/:id',        updateTask);
router.delete('/:id',     deleteTask);
router.patch('/:id/toggle', toggleStatus);

module.exports = router;