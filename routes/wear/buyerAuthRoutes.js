const express = require('express');
const router = express.Router();
const authController = require('../../controllers/wear/authController');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { otpSendLimiter, otpVerifyLimiter } = require('../../middlewares/securityMiddleware');

router.post('/send-otp', otpSendLimiter, authController.send_otp);
router.post('/verify-otp', otpVerifyLimiter, authController.verify_otp);
router.post('/refresh-token', authController.refresh_token);
router.get('/profile', authMiddleware, authController.get_profile);
router.put('/update-profile', authMiddleware, authController.update_profile);
router.post('/profile-image-upload', authMiddleware, authController.profile_image_upload);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
