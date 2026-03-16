const TickerController = require('../../controllers/Awareness/TickerController');
const router = require('express').Router();
const { authMiddleware, adminMiddleware } = require('../../middlewares/authMiddleware');

// Public
router.get('/ticker', TickerController.get_tickers);

// Admin
router.get('/admin/ticker', authMiddleware, adminMiddleware, TickerController.get_admin_tickers);
router.post('/admin/ticker/add', authMiddleware, adminMiddleware, TickerController.add_ticker);
router.put('/admin/ticker/update/:id', authMiddleware, adminMiddleware, TickerController.update_ticker);
router.delete('/admin/ticker/delete/:id', authMiddleware, adminMiddleware, TickerController.delete_ticker);
router.patch('/admin/ticker/toggle-status/:id', authMiddleware, adminMiddleware, TickerController.toggle_status);

module.exports = router;
