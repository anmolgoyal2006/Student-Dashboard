const express = require('express');
const router  = express.Router();
const {
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  saveToken,
  updateSID,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.put('/update-profile',        protect, updateProfile);
router.put('/change-password',       protect, changePassword);
router.post('/forgot-password',               forgotPassword);
router.post('/reset-password/:token',         resetPassword);
router.post('/save-token',           protect, saveToken);
router.put('/update-sid',            protect, updateSID);

module.exports = router;