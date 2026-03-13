const express = require('express');
const router = express.Router();
const profileController = require('../../controllers/hire/profileController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// Get current user's profile
router.get('/me', authMiddleware, profileController.getProfile);

// Update current user's profile
router.put('/me', authMiddleware, profileController.updateProfile);

// Admin Profile Routes
router.get('/admin/:userId', authMiddleware, profileController.getProfileByAdmin);
router.put('/admin/:userId', authMiddleware, profileController.updateProfileByAdmin);

module.exports = router;
