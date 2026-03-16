const SuccessStoryController = require('../../controllers/Awareness/SuccessStoryController')
const router = require('express').Router()
const { authMiddleware, adminMiddleware } = require('../../middlewares/authMiddleware')

// Public
router.get('/stories', SuccessStoryController.get_stories) 
router.get('/stories/:id', SuccessStoryController.get_story) 

// Admin
router.get('/admin/stories', authMiddleware, adminMiddleware, SuccessStoryController.get_admin_stories)
router.post('/admin/stories/add', authMiddleware, adminMiddleware, SuccessStoryController.add_story) 
router.put('/admin/stories/update/:id', authMiddleware, adminMiddleware, SuccessStoryController.update_story) 
router.delete('/admin/stories/delete/:id', authMiddleware, adminMiddleware, SuccessStoryController.delete_story)
router.patch('/admin/stories/toggle-status/:id', authMiddleware, adminMiddleware, SuccessStoryController.toggle_status)

module.exports = router
