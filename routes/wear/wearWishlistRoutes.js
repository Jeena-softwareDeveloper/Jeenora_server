const express = require('express');
const router = express.Router();
const wearWishlistController = require('../../controllers/wear/wearWishlistController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.post('/add', authMiddleware, wearWishlistController.add_to_wishlist);
router.get('/get', authMiddleware, wearWishlistController.get_wishlist);
router.delete('/remove/:productId', authMiddleware, wearWishlistController.remove_from_wishlist);

module.exports = router;
