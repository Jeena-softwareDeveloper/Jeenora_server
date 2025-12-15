const express = require('express')
const router = express.Router()
const paymentController = require('../../controllers/hire/paymentController')
const { authMiddleware } = require('../../middlewares/authMiddleware')

// ==================== USER PAYMENT ROUTES ====================
router.post('/create-order', authMiddleware, paymentController.createOrder)
router.post('/verify', authMiddleware, paymentController.verifyPayment)
router.get('/subscription', authMiddleware, paymentController.getSubscription)
router.post('/webhook', paymentController.paymentWebhook)

// ==================== ADMIN PAYMENT ROUTES ====================
router.get('/admin/payments', authMiddleware, paymentController.getAllPayments)
router.get('/admin/subscriptions', authMiddleware, paymentController.getSubscriptions)
router.post('/admin/payments/:id/refund', authMiddleware, paymentController.processRefund)
router.get('/admin/summary', authMiddleware, paymentController.getRevenueSummary)

// ==================== ADMIN PLAN SETTINGS ROUTES ====================
router.get('/admin/plans', authMiddleware, paymentController.getPlanSettings)
router.put('/admin/plans', authMiddleware, paymentController.updatePlanSettings)
router.put('/admin/plans/free', authMiddleware, paymentController.updateFreePlanSettings)
router.put('/admin/plans/monthly', authMiddleware, paymentController.updateMonthlySubscription)
router.put('/admin/plans/duration', authMiddleware, paymentController.updatePlanDuration)
router.put('/admin/plans/features', authMiddleware, paymentController.updatePlanFeatures)
router.put('/admin/plans/all', authMiddleware, paymentController.updateAllPlans)
router.patch('/admin/plans/:planName/toggle', authMiddleware, paymentController.togglePlanActive)
router.post('/admin/plans/discount', authMiddleware, paymentController.setDiscount)
router.delete('/admin/plans/:planName/discount', authMiddleware, paymentController.removeDiscount)

module.exports = router