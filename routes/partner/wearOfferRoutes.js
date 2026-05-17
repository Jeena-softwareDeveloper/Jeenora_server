const express = require('express');
const router = express.Router();
const wearOfferController = require('../../controllers/partner/wearOfferController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// Admin Routes
router.post('/campaign/add', authMiddleware, wearOfferController.add_campaign);
router.get('/campaign/all', authMiddleware, wearOfferController.get_all_campaigns);
router.put('/campaign/update/:campaignId', authMiddleware, wearOfferController.update_campaign);
router.delete('/campaign/delete/:campaignId', authMiddleware, wearOfferController.delete_campaign);
router.get('/campaign/:campaignId/participants', authMiddleware, wearOfferController.get_campaign_participants_admin);
router.get('/campaign/:campaignId/participant/:supplierId/products', authMiddleware, wearOfferController.get_supplier_campaign_products_admin);

// Supplier/Public Routes
router.get('/campaign/active', wearOfferController.get_active_campaigns);
router.get('/active', wearOfferController.get_active_product_offers);
router.get('/notification/my', authMiddleware, wearOfferController.get_my_notifications);
router.put('/notification/read/:notifId', authMiddleware, wearOfferController.mark_notification_read);


module.exports = router;
