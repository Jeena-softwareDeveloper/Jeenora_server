const router = require('express').Router();
const whatsappController = require('../../controllers/wear/wearWhatsAppController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.get('/status', authMiddleware, whatsappController.getStatus);
router.post('/initialize', authMiddleware, whatsappController.initialize);
router.post('/logout', authMiddleware, whatsappController.logout);
router.post('/disconnect', authMiddleware, whatsappController.logout); // Alias for logout as 'disconnect'
router.post('/test-message', authMiddleware, whatsappController.testMessage);

module.exports = router;
