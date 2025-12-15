const BannerController = require('../../controllers/Awareness/BannerController')
const router = require('express').Router()
const { authMiddleware } = require('../../middlewares/authMiddleware')


router.post('/banner-add',authMiddleware, BannerController.add_banner) 
 router.get('/banners',BannerController.get_banners) 
 router.put('/banner-update/:id',authMiddleware, BannerController.update_banner) 
 router.delete('/banner/:id', BannerController.delete_banner)
 router.patch('/banners/toggle-status/:id', BannerController.toggle_banner_status)

module.exports = router



