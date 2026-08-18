const express = require('express');
const router  = express.Router();
const { body, param } = require('express-validator');
const {
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  saveToken,
  removeToken,
  updateSID,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimitMiddleware');
const { validate } = require('../middleware/validate');

router.put('/update-profile', protect, validate([
  body('name').optional().trim().notEmpty(),
  body('email').optional().isEmail(),
  body('skills').optional().isArray(),
  body('interests').optional().isArray(),
  body('cgpa').optional().isFloat({ min: 0, max: 10 }),
  body('college').optional().isString(),
  body('semester').optional().isInt({ min: 1, max: 8 }),
  body('state').optional().isString(),
]), updateProfile);

router.put('/change-password', protect, validate([
  body('oldPassword').notEmpty().isString(),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters.'),
]), changePassword);

router.post('/forgot-password', authLimiter, validate([
  body('email').isEmail().withMessage('Please provide a valid email address.'),
]), forgotPassword);

router.post('/reset-password/:token', validate([
  param('token').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Reset link is invalid or has expired.'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
]), resetPassword);

router.post('/save-token', protect, validate([
  body('token').notEmpty().isString().withMessage('Token required'),
]), saveToken);

// DELETE /api/user/remove-token
// Called on logout so this device stops receiving push notifications.
// Body is optional — if omitted, removes ALL tokens for this user (logout-all path).
router.delete('/remove-token', protect, validate([
  body('token').optional().isString(),
]), removeToken);

router.put('/update-sid', protect, validate([
  body('sid').trim().notEmpty().withMessage('SID cannot be empty.'),
]), updateSID);

module.exports = router;