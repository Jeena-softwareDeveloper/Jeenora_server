const FarmerAuthController = require('../../controllers/Awareness/FarmerAuthController');
const router = require('express').Router();
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { authLimiter } = require('../../middlewares/securityMiddleware');

// Rate-limited auth routes to prevent brute-force attacks
router.post('/register', authLimiter, FarmerAuthController.register);
router.post('/login', authLimiter, FarmerAuthController.login);
router.get('/profile', authMiddleware, FarmerAuthController.get_profile);
router.put('/profile/update', authMiddleware, FarmerAuthController.update_profile);
router.post('/profile/image-upload', authMiddleware, FarmerAuthController.profile_image_upload);

module.exports = router;
