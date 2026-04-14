const router = require('express').Router();
const MarketPriceController = require('../../controllers/Awareness/MarketPriceController');

router.get('/latest-prices', MarketPriceController.get_latest_prices);
router.post('/seed-prices', MarketPriceController.seed_prices);

module.exports = router;
