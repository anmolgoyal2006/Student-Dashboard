const express = require('express');
const router  = express.Router();
const { addMarks, getAllMarks, getCGPA, deleteMarks } = require('../controllers/marksController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/',        addMarks);
router.get('/',         getAllMarks);
router.get('/cgpa',     getCGPA);
router.delete('/:id',   deleteMarks);

module.exports = router;
