const express = require('express');
const router = express.Router();
const wearCartController = require('../../controllers/wear/wearCartController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// All cart routes require authentication
router.use(authMiddleware);

router.post('/add', wearCartController.addToCart);
router.get('/get', wearCartController.getCart);
router.post('/update-quantity', wearCartController.updateQuantity);
router.delete('/remove/:cartId', wearCartController.removeFromCart);
router.delete('/clear', wearCartController.clearCart);

module.exports = router;
