const router = require('express').Router();
const whatsappController = require('../../controllers/wear/wearWhatsAppController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.get('/status', authMiddleware, whatsappController.getStatus);
router.post('/initialize', authMiddleware, whatsappController.initialize);
router.post('/logout', authMiddleware, whatsappController.logout);

module.exports = router;
