const express = require('express');
const router  = express.Router();
const {
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.put('/update-profile',        protect, updateProfile);
router.put('/change-password',       protect, changePassword);
router.post('/forgot-password',               forgotPassword);
router.post('/reset-password/:token',         resetPassword);

module.exports = router;