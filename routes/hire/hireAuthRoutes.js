const express = require('express');
const router = express.Router();
const hireAuthController = require('../../controllers/hire/hireAuthController');
const { authMiddleware } = require('../../middlewares/authMiddleware');


router.post('/register', hireAuthController.register); // #swagger.tags = ['Hire Auth']
router.post('/login', hireAuthController.login); // #swagger.tags = ['Hire Auth']
router.post('/social-login', hireAuthController.socialLogin); // #swagger.tags = ['Hire Auth']

router.post('/2fa/setup', authMiddleware, hireAuthController.setup2FA); // #swagger.tags = ['Hire Auth']
router.post('/2fa/verify', authMiddleware, hireAuthController.verify2FA); // #swagger.tags = ['Hire Auth']


module.exports = router;
