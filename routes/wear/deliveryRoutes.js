const router = require('express').Router();
const deliveryController = require('../../controllers/wear/deliveryController');
const shiprocketAdminController = require('../../controllers/wear/shiprocketAdminController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.get('/wear/delivery/edd', deliveryController.get_delivery_edd);

// Admin Shiprocket Management
router.get('/admin/shiprocket/wallet', authMiddleware, shiprocketAdminController.get_wallet_balance);
router.get('/admin/shiprocket/orders', authMiddleware, shiprocketAdminController.get_orders);
router.get('/admin/shiprocket/tracking/:shipmentId', authMiddleware, shiprocketAdminController.get_order_logs);

module.exports = router;
