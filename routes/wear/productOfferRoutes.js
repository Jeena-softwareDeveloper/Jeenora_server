const express = require('express');
const router = express.Router();
const productOfferController = require('../../controllers/wear/productOfferController');
const catalogOffersController = require('../../controllers/wear/catalogOffersController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.post('/wear/product-offer/add', authMiddleware, productOfferController.add_offer);
router.get('/wear/product-offer/admin-all', authMiddleware, productOfferController.get_admin_offers);
router.get('/wear/product-offer/active', productOfferController.get_active_offers);
router.put('/wear/product-offer/update/:id', authMiddleware, productOfferController.update_offer);
router.delete('/wear/product-offer/delete/:id', authMiddleware, productOfferController.delete_offer);

// Assign Offer To Product
router.put('/wear/product-offer/assign-catalog/:productId', authMiddleware, catalogOffersController.update_catalog_offers);

module.exports = router;
