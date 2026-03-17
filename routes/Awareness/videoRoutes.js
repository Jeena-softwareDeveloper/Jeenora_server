const VideoController = require('../../controllers/Awareness/VideoController')
const router = require('express').Router()
const { authMiddleware, sellerAdminMiddleware } = require('../../middlewares/authMiddleware')

// Public
router.get('/videos', VideoController.get_videos)
router.get('/video/:id', VideoController.get_video)

// Management (Admin & Seller)
router.get('/admin/videos', authMiddleware, sellerAdminMiddleware, VideoController.get_admin_videos)
router.post('/admin/video/add', authMiddleware, sellerAdminMiddleware, VideoController.add_video)
router.put('/admin/video/update/:id', authMiddleware, sellerAdminMiddleware, VideoController.update_video)
router.delete('/admin/video/delete/:id', authMiddleware, sellerAdminMiddleware, VideoController.delete_video)
router.patch('/admin/video/toggle-status/:id', authMiddleware, sellerAdminMiddleware, VideoController.toggle_status)

// Dashboard Aliases
router.post('/video-add', authMiddleware, sellerAdminMiddleware, VideoController.add_video)
router.get('/videos', authMiddleware, sellerAdminMiddleware, VideoController.get_admin_videos)
router.put('/video/update/:id', authMiddleware, sellerAdminMiddleware, VideoController.update_video)
router.delete('/video/delete/:id', authMiddleware, sellerAdminMiddleware, VideoController.delete_video)
router.patch('/video/toggle-status/:id', authMiddleware, sellerAdminMiddleware, VideoController.toggle_status)

module.exports = router
