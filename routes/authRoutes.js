const authControllers = require('../controllers/authControllers')
const { authMiddleware } = require('../middlewares/authMiddleware')
const router = require('express').Router()

// Admin routes
router.post('/admin-login', authControllers.admin_login)

// Seller routes
router.post('/seller-register', authControllers.seller_register)
router.post('/seller-login', authControllers.seller_login)



// Common routes (for all user types)
router.get('/get-user', authMiddleware, authControllers.getUser)
router.post('/profile-image-upload', authMiddleware, authControllers.profile_image_upload)
router.post('/profile-info-add', authMiddleware, authControllers.profile_info_add)
router.get('/logout', authMiddleware, authControllers.logout)

router.post('/admin/create-seller', authMiddleware, authControllers.admin_create_seller)
router.post('/admin/update-seller-permissions', authMiddleware, authControllers.update_seller_permissions)
router.post('/admin/update-seller-password', authMiddleware, authControllers.update_seller_password)

module.exports = router