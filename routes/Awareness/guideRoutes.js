const GuideController = require('../../controllers/Awareness/GuideController')
const router = require('express').Router()
const { authMiddleware, sellerAdminMiddleware } = require('../../middlewares/authMiddleware')

// Public
router.get('/guides', GuideController.get_guides)
router.get('/categories', GuideController.get_categories)
router.get('/guides/category/:categoryId', GuideController.get_guides_by_category)
router.get('/guide/:slug', GuideController.get_guide_by_slug)

// Management (Admin & Seller)
router.get('/admin/guides', authMiddleware, sellerAdminMiddleware, GuideController.get_admin_guides)
router.post('/admin/category/add', authMiddleware, sellerAdminMiddleware, GuideController.add_category)
router.delete('/admin/category/:id', authMiddleware, sellerAdminMiddleware, GuideController.delete_category)

router.post('/admin/guide/add', authMiddleware, sellerAdminMiddleware, GuideController.add_guide)
router.put('/admin/guide/update/:id', authMiddleware, sellerAdminMiddleware, GuideController.update_guide)
router.delete('/admin/guide/delete/:id', authMiddleware, sellerAdminMiddleware, GuideController.delete_guide)
router.patch('/admin/guide/toggle-status/:id', authMiddleware, sellerAdminMiddleware, GuideController.toggle_status)

// Dashboard Aliases 
router.post('/category/add', authMiddleware, sellerAdminMiddleware, GuideController.add_category)
router.delete('/category/:id', authMiddleware, sellerAdminMiddleware, GuideController.delete_category)
router.post('/guide/add', authMiddleware, sellerAdminMiddleware, GuideController.add_guide)
router.get('/guides', authMiddleware, sellerAdminMiddleware, GuideController.get_admin_guides)
router.put('/guide/update/:id', authMiddleware, sellerAdminMiddleware, GuideController.update_guide)
router.delete('/guide/delete/:id', authMiddleware, sellerAdminMiddleware, GuideController.delete_guide)
router.patch('/guide/toggle-status/:id', authMiddleware, sellerAdminMiddleware, GuideController.toggle_status)

module.exports = router