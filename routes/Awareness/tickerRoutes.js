const TickerController = require('../../controllers/Awareness/TickerController');
const router = require('express').Router();

router.get('/ticker', TickerController.get_tickers);
router.post('/ticker-add', TickerController.add_ticker);

module.exports = router;
