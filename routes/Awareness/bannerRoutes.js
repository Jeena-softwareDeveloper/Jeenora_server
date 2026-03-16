const BannerController = require('../../controllers/Awareness/BannerController')
const router = require('express').Router()
const { authMiddleware, adminMiddleware } = require('../../middlewares/authMiddleware')

// Public
router.get('/banners', BannerController.get_banners) 
router.post('/banners/track-click/:id', BannerController.track_click);

// Admin
router.get('/admin/banners', authMiddleware, adminMiddleware, BannerController.get_admin_banners)
router.get('/admin/banners/:id', authMiddleware, adminMiddleware, BannerController.get_banner)
router.post('/admin/banners/add', authMiddleware, adminMiddleware, BannerController.add_banner) 
router.put('/admin/banners/update/:id', authMiddleware, adminMiddleware, BannerController.update_banner) 
router.delete('/admin/banners/delete/:id', authMiddleware, adminMiddleware, BannerController.delete_banner)
router.patch('/admin/banners/toggle-status/:id', authMiddleware, adminMiddleware, BannerController.toggle_banner_status);

module.exports = router
