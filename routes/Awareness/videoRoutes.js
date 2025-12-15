const VideoController = require('../../controllers/Awareness/VideoController')
const router = require('express').Router()
const { authMiddleware } = require('../../middlewares/authMiddleware')

// ---------------- Video CRUD ----------------
router.post('/video-add', authMiddleware, VideoController.add_video)
router.get('/videos', VideoController.get_videos)
router.get('/video/:id', VideoController.get_video)
router.put('/video/update/:id', authMiddleware, VideoController.update_video)
router.delete('/video/delete/:id', authMiddleware, VideoController.delete_video)

// ---------------- Toggle Active/Inactive ----------------
router.patch('/video/toggle-status/:id', authMiddleware, VideoController.toggle_status)

module.exports = router
