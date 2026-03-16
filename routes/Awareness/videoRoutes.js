const VideoController = require('../../controllers/Awareness/VideoController')
const router = require('express').Router()
const { authMiddleware, adminMiddleware } = require('../../middlewares/authMiddleware')

// Public
router.get('/videos', VideoController.get_videos)
router.get('/video/:id', VideoController.get_video)

// Admin
router.get('/admin/videos', authMiddleware, adminMiddleware, VideoController.get_admin_videos)
router.post('/admin/video/add', authMiddleware, adminMiddleware, VideoController.add_video)
router.put('/admin/video/update/:id', authMiddleware, adminMiddleware, VideoController.update_video)
router.delete('/admin/video/delete/:id', authMiddleware, adminMiddleware, VideoController.delete_video)
router.patch('/admin/video/toggle-status/:id', authMiddleware, adminMiddleware, VideoController.toggle_status)

module.exports = router
