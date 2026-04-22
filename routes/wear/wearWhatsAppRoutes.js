const router = require('express').Router();
const whatsappController = require('../../controllers/wear/wearWhatsAppController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.get('/status', authMiddleware, whatsappController.getStatus);
router.post('/initialize', authMiddleware, whatsappController.initialize);
router.post('/logout', authMiddleware, whatsappController.logout);
router.post('/disconnect', authMiddleware, whatsappController.logout); // Alias for logout as 'disconnect'
router.post('/test-message', authMiddleware, whatsappController.testMessage);

// TEMPORARY: Public test route (Delete after testing)
router.post('/test-wa-public', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        const whatsappClient = require('./utiles/whatsappClient');
        await whatsappClient.sendMessage(phoneNumber, message || 'Public Test Message from Jeenora');
        res.json({ success: true, message: 'Message sent!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
