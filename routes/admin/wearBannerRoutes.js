const express = require('express');
const router = express.Router();
const wearBannerController = require('../../controllers/admin/wearBannerController');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { apiLimiter } = require('../../middlewares/securityMiddleware');

router.post('/add', authMiddleware, wearBannerController.add_banner);
router.get('/all', authMiddleware, wearBannerController.get_all_banners);
router.put('/update/:bannerId', authMiddleware, wearBannerController.update_banner);
router.delete('/delete/:bannerId', authMiddleware, wearBannerController.delete_banner);
router.get('/active', wearBannerController.get_active_banners);
router.get('/category-filters/:categorySlug', authMiddleware, wearBannerController.get_category_filters_for_banner);
router.post('/track-click/:bannerId', apiLimiter, wearBannerController.track_click);

module.exports = router;
