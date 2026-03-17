const StatsController = require('../../controllers/Awareness/StatsController');
const router = require('express').Router();

const { authMiddleware, sellerAdminMiddleware } = require('../../middlewares/authMiddleware');

router.get('/stats', StatsController.get_stats);

// Management (Admin & Seller)
router.get('/admin/stats/baseline', authMiddleware, sellerAdminMiddleware, StatsController.get_admin_baseline);
router.post('/admin/stats/update', authMiddleware, sellerAdminMiddleware, StatsController.update_baseline);

module.exports = router;
