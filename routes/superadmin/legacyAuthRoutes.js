const authControllers = require('../../controllers/superadmin/standardAuthController')
const googleAuthController = require('../../controllers/customer/googleAuthController')
const firebaseAuthController = require('../../controllers/customer/firebaseAuthController')
const adminSettingsController = require('../../controllers/superadmin/adminSettingsController')
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
router.post('/admin/create-sub-admin', authMiddleware, authControllers.create_sub_admin)
router.get('/admin/get-all-admins', authMiddleware, authControllers.get_all_admins)
router.post('/admin/update-sub-admin-status', authMiddleware, authControllers.update_sub_admin_status)
router.post('/admin/update-sub-admin-permissions', authMiddleware, authControllers.update_sub_admin_permissions)
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