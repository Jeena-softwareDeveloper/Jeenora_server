const TickerController = require('../../controllers/Awareness/TickerController');
const router = require('express').Router();
const { authMiddleware, sellerAdminMiddleware } = require('../../middlewares/authMiddleware');

// Public
router.get('/ticker', TickerController.get_tickers);

// Management (Admin & Seller)
router.get('/admin/ticker', authMiddleware, sellerAdminMiddleware, TickerController.get_admin_tickers);
router.post('/admin/ticker/add', authMiddleware, sellerAdminMiddleware, TickerController.add_ticker);
router.put('/admin/ticker/update/:id', authMiddleware, sellerAdminMiddleware, TickerController.update_ticker);
router.delete('/admin/ticker/delete/:id', authMiddleware, sellerAdminMiddleware, TickerController.delete_ticker);
router.patch('/admin/ticker/toggle-status/:id', authMiddleware, sellerAdminMiddleware, TickerController.toggle_status);

module.exports = router;
