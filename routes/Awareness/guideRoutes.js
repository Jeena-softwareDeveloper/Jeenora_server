const GuideController = require('../../controllers/Awareness/GuideController')
const router = require('express').Router()
const { authMiddleware, adminMiddleware } = require('../../middlewares/authMiddleware')

// Public
router.get('/guides', GuideController.get_guides)
router.get('/categories', GuideController.get_categories)
router.get('/guides/category/:categoryId', GuideController.get_guides_by_category)
router.get('/guide/:slug', GuideController.get_guide_by_slug)

// Admin
router.get('/admin/guides', authMiddleware, adminMiddleware, GuideController.get_admin_guides)
router.post('/admin/category/add', authMiddleware, adminMiddleware, GuideController.add_category)
router.delete('/admin/category/:id', authMiddleware, adminMiddleware, GuideController.delete_category)

router.post('/admin/guide/add', authMiddleware, adminMiddleware, GuideController.add_guide)
router.put('/admin/guide/update/:id', authMiddleware, adminMiddleware, GuideController.update_guide)
router.delete('/admin/guide/delete/:id', authMiddleware, adminMiddleware, GuideController.delete_guide)
router.patch('/admin/guide/toggle-status/:id', authMiddleware, adminMiddleware, GuideController.toggle_status)

module.exports = router