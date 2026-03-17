const SuccessStoryController = require('../../controllers/Awareness/SuccessStoryController')
const router = require('express').Router()
const { authMiddleware, sellerAdminMiddleware } = require('../../middlewares/authMiddleware')

// Public
router.get('/', SuccessStoryController.get_stories)
router.get('/stories', SuccessStoryController.get_stories) 
router.get('/stories/:id', SuccessStoryController.get_story) 

// Management (Admin & Seller)
router.get('/admin/stories', authMiddleware, sellerAdminMiddleware, SuccessStoryController.get_admin_stories)
router.post('/admin/stories/add', authMiddleware, sellerAdminMiddleware, SuccessStoryController.add_story) 
router.put('/admin/stories/update/:id', authMiddleware, sellerAdminMiddleware, SuccessStoryController.update_story) 
router.delete('/admin/stories/delete/:id', authMiddleware, sellerAdminMiddleware, SuccessStoryController.delete_story)
router.patch('/admin/stories/toggle-status/:id', authMiddleware, sellerAdminMiddleware, SuccessStoryController.toggle_status)

// Dashboard Aliases
router.get('/successstorys', authMiddleware, sellerAdminMiddleware, SuccessStoryController.get_admin_stories)
router.get('/successstorys/:id', authMiddleware, sellerAdminMiddleware, SuccessStoryController.get_story)
router.post('/successstory-add', authMiddleware, sellerAdminMiddleware, SuccessStoryController.add_story)
router.put('/successstory-update/:id', authMiddleware, sellerAdminMiddleware, SuccessStoryController.update_story)
router.delete('/successstory/:id', authMiddleware, sellerAdminMiddleware, SuccessStoryController.delete_story)
router.patch('/successstory-toggle-status/:id', authMiddleware, sellerAdminMiddleware, SuccessStoryController.toggle_status)


module.exports = router
