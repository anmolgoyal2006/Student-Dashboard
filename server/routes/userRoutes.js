const express = require('express');
const router  = express.Router();
const { updateProfile, changePassword } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.put('/update-profile',  protect, updateProfile);
router.put('/change-password', protect, changePassword);

module.exports = router;