const express = require('express');
const router  = express.Router();
const { getSubjects, addSubject, updateSubject, deleteSubject } = require('../controllers/timetableController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/',       getSubjects);
router.post('/',      addSubject);
router.put('/:id',    updateSubject);
router.delete('/:id', deleteSubject);

module.exports = router;
