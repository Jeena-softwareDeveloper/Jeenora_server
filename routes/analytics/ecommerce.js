const express = require('express');
const router = express.Router();
const ecommerceController = require('../../controllers/analytics/ecommerceController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// E-commerce tracking endpoints
router.post('/product-views', ecommerceController.trackProductView);
router.post('/cart-actions', ecommerceController.trackCartAction);
router.post('/checkout-steps', ecommerceController.trackCheckoutStep);
router.post('/transactions', ecommerceController.trackTransaction);

// Analytics dashboard (protected)
router.get('/analytics', authMiddleware, ecommerceController.getEcommerceAnalytics);

module.exports = router;