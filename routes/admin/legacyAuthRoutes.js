const authControllers = require('../../controllers/admin/standardAuthController')
const googleAuthController = require('../../controllers/customer/googleAuthController')
const firebaseAuthController = require('../../controllers/customer/firebaseAuthController')
const adminSettingsController = require('../../controllers/admin/adminSettingsController')
const { authMiddleware } = require('../../middlewares/authMiddleware')
const { authLimiter } = require('../../middlewares/securityMiddleware')
const router = require('express').Router()

// OAuth/External Auth Routes
router.post('/google-login', authLimiter, googleAuthController.googleLogin)
router.post('/firebase-phone-login', authLimiter, firebaseAuthController.firebasePhoneLogin)

// Admin routes
router.post('/admin-login', authLimiter, authControllers.admin_login)

// Partner (Admin User) routes
router.post('/admin-user-register', authLimiter, authControllers.partner_register)
router.post('/admin-user-login', authLimiter, authControllers.partner_login)

// Fallback routes
router.post('/partner-register', authLimiter, authControllers.partner_register)
router.post('/partner-login', authLimiter, authControllers.partner_login)

// Common routes (for all user types)
router.get('/get-user', authMiddleware, authControllers.getUser)
router.post('/profile-image-upload', authMiddleware, authControllers.profile_image_upload)
router.post('/profile-info-add', authMiddleware, authControllers.profile_info_add)
router.get('/logout', authMiddleware, authControllers.logout)

router.post('/admin/create-account', authMiddleware, authControllers.admin_create_partner)
router.post('/admin/create-partner', authMiddleware, authControllers.admin_create_partner)
router.post('/admin/create-manager', authMiddleware, authControllers.create_manager)
router.get('/admin/get-all-admins', authMiddleware, authControllers.get_all_admins)
router.post('/admin/update-manager-status', authMiddleware, authControllers.update_manager_status)
router.post('/admin/update-manager-permissions', authMiddleware, authControllers.update_manager_permissions)
router.post('/admin/update-manager-password', authMiddleware, authControllers.update_manager_password)
router.post('/admin/update-manager-details', authMiddleware, authControllers.update_manager_details)
router.post('/admin/delete-manager', authMiddleware, authControllers.delete_manager)
router.post('/admin/update-permissions', authMiddleware, authControllers.update_partner_permissions)
router.post('/admin/update-partner-permissions', authMiddleware, authControllers.update_partner_permissions)
router.post('/admin/update-password', authMiddleware, authControllers.update_partner_password)
router.post('/admin/update-partner-password', authMiddleware, authControllers.update_partner_password)

// Admin Settings Routes
router.get('/admin/settings/menuDisplayMode', authMiddleware, (req,res,next)=>{req.params.key='menuDisplayMode';next();}, adminSettingsController.getSetting)
router.get('/admin/settings/wear_config', authMiddleware, (req,res,next)=>{req.params.key='wear_config';next();}, adminSettingsController.getSetting)
router.get('/admin/settings', authMiddleware, adminSettingsController.getAllSettings)
router.get('/admin/settings/:key', authMiddleware, adminSettingsController.getSetting)
router.post('/admin/settings', authMiddleware, adminSettingsController.updateSetting)
router.post('/admin/settings/menu-display-mode', authMiddleware, adminSettingsController.updateMenuDisplayMode)

module.exports = router
