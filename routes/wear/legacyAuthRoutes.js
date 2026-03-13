const authControllers = require('../../controllers/wear/standardAuthController')
const googleAuthController = require('../../controllers/wear/googleAuthController')
const firebaseAuthController = require('../../controllers/wear/firebaseAuthController')
const adminSettingsController = require('../../controllers/wear/adminSettingsController')
const { authMiddleware } = require('../../middlewares/authMiddleware')
const { authLimiter } = require('../../middlewares/securityMiddleware')
const router = require('express').Router()

// OAuth/External Auth Routes
router.post('/google-login', authLimiter, googleAuthController.googleLogin)
router.post('/firebase-phone-login', authLimiter, firebaseAuthController.firebasePhoneLogin)

// Admin routes
router.post('/admin-login', authLimiter, authControllers.admin_login)

// Seller routes
router.post('/seller-register', authLimiter, authControllers.seller_register)
router.post('/seller-login', authLimiter, authControllers.seller_login)

// Hire routes
router.post('/hire-register', authLimiter, authControllers.hire_register)
router.post('/hire-login', authLimiter, authControllers.hire_login)

// Common routes (for all user types)
router.get('/get-user', authMiddleware, authControllers.getUser)
router.post('/profile-image-upload', authMiddleware, authControllers.profile_image_upload)
router.post('/profile-info-add', authMiddleware, authControllers.profile_info_add)
router.get('/logout', authMiddleware, authControllers.logout)

router.post('/admin/create-seller', authMiddleware, authControllers.admin_create_seller)
router.post('/admin/update-seller-permissions', authMiddleware, authControllers.update_seller_permissions)
router.post('/admin/update-seller-password', authMiddleware, authControllers.update_seller_password)

// Admin Settings Routes
router.get('/admin/settings', authMiddleware, adminSettingsController.getAllSettings)
router.get('/admin/settings/:key', authMiddleware, adminSettingsController.getSetting)
router.post('/admin/settings', authMiddleware, adminSettingsController.updateSetting)
router.post('/admin/settings/menu-display-mode', authMiddleware, adminSettingsController.updateMenuDisplayMode)

module.exports = router