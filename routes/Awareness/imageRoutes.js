const ImageController = require('../../controllers/Awareness/ImageController')
const router = require('express').Router()
const { authMiddleware, sellerAdminMiddleware } = require('../../middlewares/authMiddleware')


router.post('/image-add', authMiddleware, sellerAdminMiddleware, ImageController.add_image) 
 router.get('/images', ImageController.get_images) 
 router.put('/image-update/:id', authMiddleware, sellerAdminMiddleware, ImageController.update_image) 
 router.delete('/image/:id', authMiddleware, sellerAdminMiddleware, ImageController.delete_image)
 router.patch('/images/toggle-status/:id', authMiddleware, sellerAdminMiddleware, ImageController.toggle_image_status);

module.exports = router



