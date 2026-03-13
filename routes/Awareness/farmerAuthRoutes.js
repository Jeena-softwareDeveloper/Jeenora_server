const FarmerAuthController = require('../../controllers/Awareness/FarmerAuthController');
const router = require('express').Router();
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.post('/register', FarmerAuthController.register);
router.post('/login', FarmerAuthController.login);
router.get('/profile', authMiddleware, FarmerAuthController.get_profile);
router.put('/profile/update', authMiddleware, FarmerAuthController.update_profile);

module.exports = router;
