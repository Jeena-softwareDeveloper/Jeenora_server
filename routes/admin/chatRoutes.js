const ChatController = require('../../controllers/admin/chatController')
const { authMiddleware } = require('../../middlewares/authMiddleware')
const router = require('express').Router()

router.post('/chat/customer/add-customer-friend', ChatController.add_customer_friend)
router.post('/chat/customer/send-message-to-partner', ChatController.customer_message_add)

// Admin User (Partner) <-> Customer
router.get('/chat/admin-user/get-customers/:partnerId', ChatController.get_customers)
router.get('/chat/admin-user/get-customer-message/:customerId', authMiddleware, ChatController.get_customers_partner_message)
router.post('/chat/admin-user/send-message-to-customer', authMiddleware, ChatController.partner_message_add)

// Superadmin <-> Admin User (Partner)
router.get('/chat/superadmin/get-admins', authMiddleware, ChatController.get_partners)
router.post('/chat/message-send-admin-support', authMiddleware, ChatController.partner_admin_message_insert)
router.get('/chat/get-superadmin-messages/:receverId', authMiddleware, ChatController.get_admin_messages)
router.get('/chat/get-admin-user-messages', authMiddleware, ChatController.get_partner_messages)

router.get('/chat/partner/get-admin-messages', authMiddleware, ChatController.get_hire_support_messages)
router.post('/chat/partner/support-message', authMiddleware, ChatController.insert_hire_support_message)

// Fallbacks
router.get('/chat/partner/get-customers/:partnerId', ChatController.get_customers)
router.get('/chat/partner/get-customer-message/:customerId', authMiddleware, ChatController.get_customers_partner_message)
router.post('/chat/partner/send-message-to-customer', authMiddleware, ChatController.partner_message_add)
router.get('/chat/admin/get-partners', authMiddleware, ChatController.get_partners)
router.post('/chat/message-send-partner-admin', authMiddleware, ChatController.partner_admin_message_insert)
router.get('/chat/get-admin-messages/:receverId', authMiddleware, ChatController.get_admin_messages)
router.get('/chat/get-partner-messages', authMiddleware, ChatController.get_partner_messages)

module.exports = router