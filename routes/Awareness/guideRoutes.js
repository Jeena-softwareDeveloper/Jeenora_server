const GuideController = require('../../controllers/Awareness/GuideController')
const router = require('express').Router()
const { authMiddleware } = require('../../middlewares/authMiddleware')


router.post('/category/add', authMiddleware, GuideController.add_category)
router.get('/categories', GuideController.get_categories)
router.delete('/category/:id', authMiddleware, GuideController.delete_category)

router.post('/guide/add', authMiddleware, GuideController.add_guide)
router.get('/guides', GuideController.get_guides)
router.get('/guides/category/:categoryId', GuideController.get_guides_by_category)
router.put('/guide/update/:id', authMiddleware, GuideController.update_guide)
router.delete('/guide/delete/:id', authMiddleware, GuideController.delete_guide)
 router.patch('/guide/toggle-status/:id', authMiddleware, GuideController.toggle_status)

module.exports = router