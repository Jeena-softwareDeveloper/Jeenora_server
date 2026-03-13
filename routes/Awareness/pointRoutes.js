const PointsController = require('../../controllers/Awareness/PointsController')
const router = require('express').Router()
const { authMiddleware } = require('../../middlewares/authMiddleware')


router.get('/point-list',PointsController.get_points)

router.post('/set-points',authMiddleware, PointsController.set_points)

module.exports = router


