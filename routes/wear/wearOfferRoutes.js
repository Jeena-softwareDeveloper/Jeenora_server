const express = require('express');
const router = express.Router();
const wearOfferController = require('../../controllers/wear/wearOfferController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// Admin Routes
router.post('/wear/offer/campaign/add', authMiddleware, wearOfferController.add_campaign);
router.get('/wear/offer/campaign/all', authMiddleware, wearOfferController.get_all_campaigns);
router.put('/wear/offer/campaign/update/:campaignId', authMiddleware, wearOfferController.update_campaign);
router.delete('/wear/offer/campaign/delete/:campaignId', authMiddleware, wearOfferController.delete_campaign);
router.get('/wear/offer/campaign/:campaignId/participants', authMiddleware, wearOfferController.get_campaign_participants_admin);
router.get('/wear/offer/campaign/:campaignId/participant/:supplierId/products', authMiddleware, wearOfferController.get_supplier_campaign_products_admin);

// Supplier/Public Routes
router.get('/wear/offer/campaign/active', wearOfferController.get_active_campaigns);
router.get('/wear/offer/notification/my', authMiddleware, wearOfferController.get_my_notifications);
router.put('/wear/offer/notification/read/:notifId', authMiddleware, wearOfferController.mark_notification_read);


module.exports = router;
