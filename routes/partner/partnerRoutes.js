const partnerController = require('../../controllers/partner/partnerController')
const { authMiddleware } = require('../../middlewares/authMiddleware')
const router = require('express').Router()

router.get('/request-admin-get', authMiddleware, partnerController.request_admin_get)
router.get('/get-admin/:adminId', authMiddleware, partnerController.get_admin)
router.post('/admin-status-update', authMiddleware, partnerController.admin_status_update)
router.get('/get-admins', authMiddleware, partnerController.get_active_admins)

router.get('/get-deactive-admins', authMiddleware, partnerController.get_deactive_admins)
router.post('/admin-profile-update', authMiddleware, partnerController.admin_profile_update)

module.exports = router
