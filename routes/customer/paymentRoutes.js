const paymentController = require('../../controllers/customer/paymentController')
const { authMiddleware } = require('../../middlewares/authMiddleware')
const router = require('express').Router()

router.get('/payment/admin-payment-details/:partnerId', authMiddleware, paymentController.get_partner_payment_details)
router.post('/payment/withdrowal-request', authMiddleware, paymentController.withdrawal_request)
router.post('/payment/withdrawal-request', authMiddleware, paymentController.withdrawal_request)
router.get('/payment/request', authMiddleware, paymentController.get_payment_request)
router.post('/payment/request-confirm', authMiddleware, paymentController.payment_request_confirm)

router.get('/payment/partner-payment-details/:partnerId', authMiddleware, paymentController.get_partner_payment_details)

module.exports = router
