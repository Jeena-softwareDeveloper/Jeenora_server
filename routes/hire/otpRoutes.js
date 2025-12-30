const express = require('express');
const router = express.Router();
const otpController = require('../../controllers/hire/otpController');

// OTP routes
router.post('/send', otpController.sendOTP);
router.post('/verify', otpController.verifyOTP);
router.post('/resend', otpController.resendOTP);

module.exports = router;
