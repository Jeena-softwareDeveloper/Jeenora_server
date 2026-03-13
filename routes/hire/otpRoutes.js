const express = require('express');
const router = express.Router();
const otpController = require('../../controllers/hire/otpController');
const { otpSendLimiter, otpVerifyLimiter } = require('../../middlewares/securityMiddleware');
const { validateOtpSend, validateOtpVerify } = require('../../middlewares/validationMiddleware');

// OTP routes
router.post('/send', otpSendLimiter, validateOtpSend, otpController.sendOTP);
router.post('/verify', otpVerifyLimiter, validateOtpVerify, otpController.verifyOTP);
router.post('/resend', otpSendLimiter, validateOtpSend, otpController.resendOTP);

module.exports = router;
