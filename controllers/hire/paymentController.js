const { responseReturn } = require("../../utiles/response")
const hireUserModel = require('../../models/hire/hireUserModel')
const Payment = require('../../models/hire/paymentModel')
const razorpayService = require('./Services/razorpayService')
const mongoose = require('mongoose')

class PaymentController {

    // Plan configuration stored in memory (you can move to database later)
    plans = {
        'Free': { 
            price: 0, 
            days: 7, 
            active: true,
            description: 'Basic plan for getting started',
            features: ['Basic alerts', '3 Job Applications'],
            maxApplications: 3,
            discount: null
        },
        'Basic': { 
            price: 199, 
            days: 30, 
            active: true,
            description: 'Standard plan for regular users',
            features: ['Unlimited job alerts', '10 Job Applications', 'Resume Download'],
            maxApplications: 10,
            discount: null
        },
        'Pro': { 
            price: 499, 
            days: 90, 
            active: true,
            description: 'Professional plan for serious job seekers',
            features: ['Priority alerts', 'Unlimited Applications', 'Featured Profile'],
            maxApplications: 0, // 0 means unlimited
            discount: null
        },
        'Elite': { 
            price: 999, 
            days: 180, 
            active: true,
            description: 'Premium plan with exclusive features',
            features: ['AI resume', 'VIP alerts', 'Dedicated Support'],
            maxApplications: 0,
            discount: null
        }
    }

    // ==================== USER PAYMENT APIS ====================

   createOrder = async (req, res) => {
    const { id } = req
    const { plan } = req.body

    try {
        // Validate plan
        if (!this.plans[plan] || !this.plans[plan].active) {
            return responseReturn(res, 400, { error: 'Invalid plan selected' })
        }

        const planConfig = this.plans[plan]
        
        // Calculate final price (apply discount if available)
        let finalPrice = planConfig.price
        if (planConfig.discount) {
            if (planConfig.discount.percentage) {
                finalPrice = planConfig.price - (planConfig.price * planConfig.discount.percentage / 100)
            } else if (planConfig.discount.amount) {
                finalPrice = planConfig.price - planConfig.discount.amount
            }
            finalPrice = Math.max(0, Math.round(finalPrice))
        }
        
        // Free plan - activate directly
        if (plan === 'Free') {
            const expiresAt = new Date()
            expiresAt.setDate(expiresAt.getDate() + planConfig.days)

            await hireUserModel.findByIdAndUpdate(id, {
                subscription: {
                    plan: plan,
                    status: 'active',
                    startDate: new Date(),
                    expiresAt: expiresAt,
                    features: planConfig.features,
                    maxApplications: planConfig.maxApplications
                }
            })

            return responseReturn(res, 200, { 
                message: 'Free plan activated successfully',
                plan: plan,
                expiresAt: expiresAt
            })
        }

        // Paid plan - create Razorpay order
        // FIX: Create shorter receipt ID (max 40 characters)
        const timestamp = Date.now().toString().slice(-10) // Last 10 digits of timestamp
        const shortId = id.toString().slice(-8) // Last 8 characters of user ID
        const receipt = `rcpt_${shortId}_${timestamp}` // Total: 8 + 1 + 8 + 1 + 10 = 28 characters

        console.log('Creating Razorpay order with receipt:', receipt, 'Amount:', finalPrice)

        const order = await razorpayService.createOrder(finalPrice, receipt)

        if (order) {
            // Save payment record
            await Payment.create({
                userId: id,
                plan: plan,
                amount: finalPrice,
                originalAmount: planConfig.price,
                razorpayOrderId: order.id,
                status: 'pending',
                discount: planConfig.discount
            })

            responseReturn(res, 201, { 
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                plan: plan,
                originalPrice: planConfig.price,
                discountedPrice: finalPrice,
                discount: planConfig.discount
            })
        } else {
            responseReturn(res, 500, { error: 'Order creation failed' })
        }
        
    } catch (error) {
        console.error('Create order error:', error)
        responseReturn(res, 500, { error: 'Internal Server Error' })
    }
}

    verifyPayment = async (req, res) => {
        const { id } = req
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body

        try {
            const isValid = razorpayService.verifySignature(
                razorpay_order_id, 
                razorpay_payment_id, 
                razorpay_signature
            )

            if (!isValid) {
                // Update payment status to failed
                await Payment.findOneAndUpdate(
                    { razorpayOrderId: razorpay_order_id },
                    { status: 'failed' }
                )
                return responseReturn(res, 400, { error: 'Payment verification failed' })
            }

            // Find payment record
            const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id })
            if (!payment) {
                return responseReturn(res, 404, { error: 'Payment record not found' })
            }

            // Calculate expiry date
            const planConfig = this.plans[payment.plan]
            const expiresAt = new Date()
            expiresAt.setDate(expiresAt.getDate() + planConfig.days)

            // Update user subscription
            const updatedUser = await hireUserModel.findByIdAndUpdate(id, {
                subscription: {
                    plan: payment.plan,
                    status: 'active',
                    startDate: new Date(),
                    expiresAt: expiresAt,
                    paymentId: razorpay_payment_id,
                    features: planConfig.features,
                    maxApplications: planConfig.maxApplications
                }
            }, { new: true })

            // Update payment record
            await Payment.findByIdAndUpdate(payment._id, {
                razorpayPaymentId: razorpay_payment_id,
                status: 'success',
                paidAt: new Date()
            })

            responseReturn(res, 200, { 
                user: updatedUser,
                message: 'Payment verified and subscription activated'
            })
            
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    getSubscription = async (req, res) => {
        const { id } = req

        try {
            const user = await hireUserModel.findById(id)
            
            if (!user) {
                return responseReturn(res, 404, { error: 'User not found' })
            }

            const subscription = user.subscription || {
                plan: 'Free',
                status: 'inactive',
                startDate: null,
                expiresAt: null
            }

            // Check if subscription expired
            if (subscription.expiresAt && new Date() > subscription.expiresAt) {
                subscription.status = 'inactive'
                // Update in database
                await hireUserModel.findByIdAndUpdate(id, {
                    'subscription.status': 'inactive'
                })
            }

            responseReturn(res, 200, { 
                subscription: {
                    plan: subscription.plan,
                    status: subscription.status,
                    startDate: subscription.startDate,
                    expiresAt: subscription.expiresAt,
                    features: subscription.features,
                    maxApplications: subscription.maxApplications
                },
                planDetails: this.plans[subscription.plan]
            })
            
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    paymentWebhook = async (req, res) => {
        const webhookSignature = req.headers['x-razorpay-signature']
        const webhookBody = JSON.stringify(req.body)

        try {
            const isValid = razorpayService.verifyWebhookSignature(webhookBody, webhookSignature)
            
            if (!isValid) {
                return responseReturn(res, 400, { error: 'Invalid webhook signature' })
            }

            const event = req.body.event
            const payment = req.body.payload.payment.entity

            if (event === 'payment.captured') {
                // Find and update payment record
                await Payment.findOneAndUpdate(
                    { razorpayOrderId: payment.order_id },
                    {
                        razorpayPaymentId: payment.id,
                        status: 'success',
                        paidAt: new Date(payment.created_at * 1000)
                    }
                )

                // Find user and update subscription
                const paymentRecord = await Payment.findOne({ razorpayOrderId: payment.order_id })
                if (paymentRecord && paymentRecord.userId) {
                    const planConfig = this.plans[paymentRecord.plan]
                    const expiresAt = new Date()
                    expiresAt.setDate(expiresAt.getDate() + planConfig.days)

                    await hireUserModel.findByIdAndUpdate(paymentRecord.userId, {
                        subscription: {
                            plan: paymentRecord.plan,
                            status: 'active',
                            startDate: new Date(),
                            expiresAt: expiresAt,
                            paymentId: payment.id,
                            features: planConfig.features,
                            maxApplications: planConfig.maxApplications
                        }
                    })
                }
            } else if (event === 'payment.failed') {
                await Payment.findOneAndUpdate(
                    { razorpayOrderId: payment.order_id },
                    { status: 'failed' }
                )
            }

            responseReturn(res, 200, { message: 'Webhook processed successfully' })
            
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    // ==================== ADMIN PAYMENT APIS ====================

    getAllPayments = async (req, res) => {
        const { page = 1, parPage = 10, searchValue, status, plan } = req.query

        try {
            let skipPage = parseInt(parPage) * (parseInt(page) - 1)
            let query = {}

            // Build search query
            if (searchValue) {
                query.$or = [
                    { razorpayOrderId: { $regex: searchValue, $options: 'i' } },
                    { razorpayPaymentId: { $regex: searchValue, $options: 'i' } }
                ]
            }

            if (status && status !== 'all') {
                query.status = status
            }

            if (plan && plan !== 'all') {
                query.plan = plan
            }

            const payments = await Payment.find(query)
                .populate('userId', 'name email phone')
                .skip(skipPage)
                .limit(parseInt(parPage))
                .sort({ createdAt: -1 })

            const totalPayments = await Payment.countDocuments(query)

            responseReturn(res, 200, {
                payments,
                totalPayments,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalPayments / parPage),
                    totalItems: totalPayments
                }
            })
            
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    getSubscriptions = async (req, res) => {
        const { page = 1, parPage = 10, status, plan } = req.query

        try {
            let skipPage = parseInt(parPage) * (parseInt(page) - 1)
            let query = {}

            if (status && status !== 'all') {
                query['subscription.status'] = status
            }

            if (plan && plan !== 'all') {
                query['subscription.plan'] = plan
            }

            const users = await hireUserModel.find(query)
                .select('name email phone subscription createdAt')
                .skip(skipPage)
                .limit(parseInt(parPage))
                .sort({ 'subscription.startDate': -1 })

            const totalUsers = await hireUserModel.countDocuments(query)

            // Get subscription statistics
            const stats = await hireUserModel.aggregate([
                {
                    $group: {
                        _id: '$subscription.status',
                        count: { $sum: 1 }
                    }
                }
            ])

            const planStats = await hireUserModel.aggregate([
                {
                    $group: {
                        _id: '$subscription.plan',
                        count: { $sum: 1 },
                        active: {
                            $sum: {
                                $cond: [{ $eq: ['$subscription.status', 'active'] }, 1, 0]
                            }
                        }
                    }
                }
            ])

            responseReturn(res, 200, {
                users,
                totalUsers,
                stats,
                planStats,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalUsers / parPage),
                    totalItems: totalUsers
                }
            })
            
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    processRefund = async (req, res) => {
        const { id } = req.params

        try {
            const payment = await Payment.findById(id)
            
            if (!payment) {
                return responseReturn(res, 404, { error: 'Payment not found' })
            }

            if (payment.status !== 'success') {
                return responseReturn(res, 400, { error: 'Can only refund successful payments' })
            }

            // In a real implementation, you would call Razorpay refund API here
            // For now, we'll just mark it as refunded in our database
            await Payment.findByIdAndUpdate(id, {
                status: 'refunded',
                refundedAt: new Date()
            })

            // Also deactivate user subscription
            await hireUserModel.findOneAndUpdate(
                { 'subscription.paymentId': payment.razorpayPaymentId },
                { 'subscription.status': 'inactive' }
            )

            responseReturn(res, 200, {
                message: 'Refund processed successfully',
                paymentId: payment._id
            })
            
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    getRevenueSummary = async (req, res) => {
        const { period = 'monthly' } = req.query // daily, weekly, monthly

        try {
            let groupQuery = {}
            let matchQuery = { status: 'success' }

            // Set date range based on period
            const now = new Date()
            let startDate = new Date()

            if (period === 'daily') {
                startDate.setDate(now.getDate() - 30) // Last 30 days
                groupQuery = {
                    year: { $year: '$paidAt' },
                    month: { $month: '$paidAt' },
                    day: { $dayOfMonth: '$paidAt' }
                }
            } else if (period === 'weekly') {
                startDate.setDate(now.getDate() - 90) // Last 90 days
                groupQuery = {
                    year: { $year: '$paidAt' },
                    week: { $week: '$paidAt' }
                }
            } else { // monthly
                startDate.setFullYear(now.getFullYear() - 1) // Last 12 months
                groupQuery = {
                    year: { $year: '$paidAt' },
                    month: { $month: '$paidAt' }
                }
            }

            matchQuery.paidAt = { $gte: startDate }

            // Revenue trend
            const revenueTrend = await Payment.aggregate([
                { $match: matchQuery },
                {
                    $group: {
                        _id: groupQuery,
                        revenue: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
            ])

            // Plan-wise revenue
            const planRevenue = await Payment.aggregate([
                { $match: { status: 'success' } },
                {
                    $group: {
                        _id: '$plan',
                        revenue: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                }
            ])

            // Total statistics
            const totalStats = await Payment.aggregate([
                { $match: { status: 'success' } },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$amount' },
                        totalPayments: { $sum: 1 },
                        averageOrderValue: { $avg: '$amount' }
                    }
                }
            ])

            // Current month revenue
            const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
            const currentMonthStats = await Payment.aggregate([
                { 
                    $match: { 
                        status: 'success',
                        paidAt: { $gte: currentMonthStart }
                    } 
                },
                {
                    $group: {
                        _id: null,
                        currentMonthRevenue: { $sum: '$amount' },
                        currentMonthPayments: { $sum: 1 }
                    }
                }
            ])

            responseReturn(res, 200, {
                revenueTrend,
                planRevenue,
                totalStats: totalStats[0] || { totalRevenue: 0, totalPayments: 0, averageOrderValue: 0 },
                currentMonthStats: currentMonthStats[0] || { currentMonthRevenue: 0, currentMonthPayments: 0 },
                period: period
            })
            
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    // ==================== ADMIN PLAN SETTINGS APIS ====================

    getPlanSettings = async (req, res) => {
        try {
            responseReturn(res, 200, { 
                plans: this.plans,
                message: 'Plan settings retrieved successfully'
            })
            
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    updatePlanSettings = async (req, res) => {
        const { planName, settings } = req.body

        try {
            // Validate plan exists
            if (!this.plans[planName]) {
                return responseReturn(res, 404, { error: 'Plan not found' })
            }

            // Update plan settings
            Object.keys(settings).forEach(key => {
                if (this.plans[planName][key] !== undefined) {
                    this.plans[planName][key] = settings[key]
                }
            })

            responseReturn(res, 200, {
                plan: this.plans[planName],
                message: `${planName} plan updated successfully`
            })
            
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    updateFreePlanSettings = async (req, res) => {
        const { days, active, features, maxApplications, description } = req.body

        try {
            // Update Free plan settings
            if (days !== undefined) this.plans.Free.days = days
            if (active !== undefined) this.plans.Free.active = active
            if (features !== undefined) this.plans.Free.features = features
            if (maxApplications !== undefined) this.plans.Free.maxApplications = maxApplications
            if (description !== undefined) this.plans.Free.description = description

            responseReturn(res, 200, {
                plan: this.plans.Free,
                message: 'Free plan settings updated successfully'
            })
            
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    updateMonthlySubscription = async (req, res) => {
        const { basicPrice, proPrice, elitePrice, basicDays, proDays, eliteDays } = req.body

        try {
            // Update Basic plan
            if (basicPrice !== undefined) this.plans.Basic.price = basicPrice
            if (basicDays !== undefined) this.plans.Basic.days = basicDays

            // Update Pro plan
            if (proPrice !== undefined) this.plans.Pro.price = proPrice
            if (proDays !== undefined) this.plans.Pro.days = proDays

            // Update Elite plan
            if (elitePrice !== undefined) this.plans.Elite.price = elitePrice
            if (eliteDays !== undefined) this.plans.Elite.days = eliteDays

            responseReturn(res, 200, {
                plans: {
                    Basic: this.plans.Basic,
                    Pro: this.plans.Pro,
                    Elite: this.plans.Elite
                },
                message: 'Monthly subscription plans updated successfully'
            })
            
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    togglePlanActive = async (req, res) => {
        const { planName } = req.params

        try {
            if (!this.plans[planName]) {
                return responseReturn(res, 404, { error: 'Plan not found' })
            }

            // Don't allow disabling Free plan
            if (planName === 'Free') {
                return responseReturn(res, 400, { error: 'Cannot disable Free plan' })
            }

            this.plans[planName].active = !this.plans[planName].active

            responseReturn(res, 200, {
                plan: this.plans[planName],
                message: `${planName} plan ${this.plans[planName].active ? 'activated' : 'deactivated'} successfully`
            })
            
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    setDiscount = async (req, res) => {
        const { planName, discountPercentage, discountAmount, validUntil } = req.body

        try {
            if (!this.plans[planName]) {
                return responseReturn(res, 404, { error: 'Plan not found' })
            }

            // Don't allow discount on Free plan
            if (planName === 'Free') {
                return responseReturn(res, 400, { error: 'Cannot set discount on Free plan' })
            }

            // Calculate discounted price
            const originalPrice = this.plans[planName].price
            let discountedPrice = originalPrice

            if (discountPercentage) {
                discountedPrice = originalPrice - (originalPrice * discountPercentage / 100)
            } else if (discountAmount) {
                discountedPrice = originalPrice - discountAmount
            }

            // Ensure discounted price is not negative
            discountedPrice = Math.max(0, Math.round(discountedPrice))

            // Store discount info
            this.plans[planName].discount = {
                originalPrice: originalPrice,
                discountedPrice: discountedPrice,
                discountPercentage: discountPercentage,
                discountAmount: discountAmount,
                validUntil: validUntil ? new Date(validUntil) : null,
                createdAt: new Date()
            }

            responseReturn(res, 200, {
                plan: this.plans[planName],
                message: `Discount applied to ${planName} plan successfully`
            })
            
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    removeDiscount = async (req, res) => {
        const { planName } = req.params

        try {
            if (!this.plans[planName]) {
                return responseReturn(res, 404, { error: 'Plan not found' })
            }

            // Remove discount
            this.plans[planName].discount = null

            responseReturn(res, 200, {
                plan: this.plans[planName],
                message: `Discount removed from ${planName} plan successfully`
            })
            
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    updatePlanDuration = async (req, res) => {
        const { planName, days } = req.body

        try {
            if (!this.plans[planName]) {
                return responseReturn(res, 404, { error: 'Plan not found' })
            }

            if (days < 1) {
                return responseReturn(res, 400, { error: 'Duration must be at least 1 day' })
            }

            this.plans[planName].days = days

            responseReturn(res, 200, {
                plan: this.plans[planName],
                message: `${planName} plan duration updated to ${days} days`
            })
            
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    updatePlanFeatures = async (req, res) => {
        const { planName, features } = req.body

        try {
            if (!this.plans[planName]) {
                return responseReturn(res, 404, { error: 'Plan not found' })
            }

            if (!Array.isArray(features)) {
                return responseReturn(res, 400, { error: 'Features must be an array' })
            }

            this.plans[planName].features = features

            responseReturn(res, 200, {
                plan: this.plans[planName],
                message: `${planName} plan features updated successfully`
            })
            
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    updateAllPlans = async (req, res) => {
        const { plans } = req.body

        try {
            Object.keys(plans).forEach(planName => {
                if (this.plans[planName]) {
                    Object.keys(plans[planName]).forEach(key => {
                        if (this.plans[planName][key] !== undefined) {
                            this.plans[planName][key] = plans[planName][key]
                        }
                    })
                }
            })

            responseReturn(res, 200, {
                plans: this.plans,
                message: 'All plans updated successfully'
            })
            
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }
}

module.exports = new PaymentController()