const BannerController = require('../../controllers/Awareness/BannerController')
const router = require('express').Router()
const { authMiddleware, sellerAdminMiddleware } = require('../../middlewares/authMiddleware')

// Public
router.get('/banners', BannerController.get_banners) 
router.post('/banners/track-click/:id', BannerController.track_click);

// Management (Admin & Seller)
router.get('/admin/banners', authMiddleware, sellerAdminMiddleware, BannerController.get_admin_banners)
router.get('/admin/banners/:id', authMiddleware, sellerAdminMiddleware, BannerController.get_banner)
router.post('/admin/banners/add', authMiddleware, sellerAdminMiddleware, BannerController.add_banner) 
router.put('/admin/banners/update/:id', authMiddleware, sellerAdminMiddleware, BannerController.update_banner) 
router.delete('/admin/banners/delete/:id', authMiddleware, sellerAdminMiddleware, BannerController.delete_banner)
router.patch('/admin/banners/toggle-status/:id', authMiddleware, sellerAdminMiddleware, BannerController.toggle_banner_status);

router.post('/banner-add', authMiddleware, sellerAdminMiddleware, BannerController.add_banner) 
router.patch('/banners/toggle-status/:id', authMiddleware, sellerAdminMiddleware, BannerController.toggle_banner_status)
router.get('/banners', authMiddleware, sellerAdminMiddleware, BannerController.get_admin_banners)
router.put('/banner-update/:id', authMiddleware, sellerAdminMiddleware, BannerController.update_banner)
router.delete('/banner/:id', authMiddleware, sellerAdminMiddleware, BannerController.delete_banner)

module.exports = router
