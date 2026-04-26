const router = require('express').Router();
const deliveryController = require('../../controllers/wear/deliveryController');
const shiprocketAdminController = require('../../controllers/wear/shiprocketAdminController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.get('/edd', deliveryController.get_delivery_edd);
router.get('/pincode', deliveryController.get_pincode_from_location);

// Admin Shiprocket Management
router.get('/admin/shiprocket/wallet', authMiddleware, shiprocketAdminController.get_wallet_balance);
router.get('/admin/shiprocket/orders', authMiddleware, shiprocketAdminController.get_orders);
router.get('/admin/shiprocket/tracking/:shipmentId', authMiddleware, shiprocketAdminController.get_order_logs);
router.get('/admin/shiprocket/ndr', authMiddleware, shiprocketAdminController.get_ndr_reports);
router.get('/admin/shiprocket/risk/:mobile', authMiddleware, shiprocketAdminController.get_rto_risk);
router.post('/admin/shiprocket/label', authMiddleware, shiprocketAdminController.generate_label);
router.get('/admin/shiprocket/track/:awb', authMiddleware, shiprocketAdminController.track_awb);

module.exports = router;
