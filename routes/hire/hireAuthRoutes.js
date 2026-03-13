const express = require('express');
const router = express.Router();
const hireAuthController = require('../../controllers/hire/hireAuthController');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { authLimiter } = require('../../middlewares/securityMiddleware');
const { validateLogin, validateRegister } = require('../../middlewares/validationMiddleware');

router.post('/register', authLimiter, validateRegister, hireAuthController.register); // #swagger.tags = ['Hire Auth']
router.post('/login', authLimiter, validateLogin, hireAuthController.login); // #swagger.tags = ['Hire Auth']
router.post('/social-login', authLimiter, hireAuthController.socialLogin); // #swagger.tags = ['Hire Auth']

router.post('/2fa/setup', authMiddleware, hireAuthController.setup2FA); // #swagger.tags = ['Hire Auth']
router.post('/2fa/verify', authMiddleware, hireAuthController.verify2FA); // #swagger.tags = ['Hire Auth']

module.exports = router;
