const router = require('express').Router();
const profileController = require('../../controllers/wear/profileController');
const walletController = require('../../controllers/wear/walletController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/profile', profileController.get_profile);
router.put('/profile/update', profileController.update_profile);
router.get('/wallet', walletController.get_wallet);
router.get('/bank-details', profileController.get_bank_details);
router.post('/support', profileController.submit_support_ticket);

// Settings
router.get('/notification-settings', profileController.get_notification_settings);
router.put('/notification-settings', profileController.update_notification_settings);
router.get('/privacy-settings', profileController.get_privacy_settings);
router.put('/privacy-settings', profileController.update_privacy_settings);

module.exports = router;
