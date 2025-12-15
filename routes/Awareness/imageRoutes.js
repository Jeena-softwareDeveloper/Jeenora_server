const ImageController = require('../../controllers/Awareness/ImageController')
const router = require('express').Router()
const { authMiddleware } = require('../../middlewares/authMiddleware')


router.post('/image-add',authMiddleware, ImageController.add_image) 
 router.get('/images',ImageController.get_images) 
 router.put('/image-update/:id',authMiddleware, ImageController.update_image) 
 router.delete('/image/:id', ImageController.delete_image)
 router.patch('/images/toggle-status/:id', authMiddleware, ImageController.toggle_image_status);

module.exports = router



