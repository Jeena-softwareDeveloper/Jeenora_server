const PointsController = require('../../controllers/Awareness/PointsController')
const router = require('express').Router()
const { authMiddleware, sellerAdminMiddleware } = require('../../middlewares/authMiddleware')


router.get('/point-list', PointsController.get_points)

router.post('/set-points', authMiddleware, sellerAdminMiddleware, PointsController.set_points)

module.exports = router


