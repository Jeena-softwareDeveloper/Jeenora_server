const BannerController = require('../../controllers/Awareness/BannerController')
const router = require('express').Router()
const { authMiddleware } = require('../../middlewares/authMiddleware')


router.post('/banner-add',authMiddleware, BannerController.add_banner) 
 router.get('/banners',BannerController.get_banners) 
 router.put('/banner-update/:id',authMiddleware, BannerController.update_banner) 
 router.delete('/banner/:id', BannerController.delete_banner)
// Toggle isActive
router.patch('/banners/toggle-status/:id', authMiddleware, BannerController.toggle_banner_status);

// Track Click
router.post('/banners/track-click/:id', BannerController.track_click);

module.exports = router
