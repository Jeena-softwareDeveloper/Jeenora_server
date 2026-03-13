const express = require('express');
const router = express.Router();
const passwordResetController = require('../../controllers/hire/passwordResetController');
const { otpSendLimiter, authLimiter } = require('../../middlewares/securityMiddleware');
const { validatePasswordReset, validateNewPassword } = require('../../middlewares/validationMiddleware');

// Password reset routes
router.post('/send-link', otpSendLimiter, validatePasswordReset, passwordResetController.sendResetLink);
router.get('/verify-token', passwordResetController.verifyResetToken);
router.post('/reset', authLimiter, validateNewPassword, passwordResetController.resetPassword);

module.exports = router;
