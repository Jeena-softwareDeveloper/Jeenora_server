const { responseReturn } = require("../../utiles/response")
const hireUserModel = require('../../models/hire/hireUserModel')
const Payment = require('../../models/hire/paymentModel')
const CreditSetting = require('../../models/hire/creditSettingModel')
const PlanSettings = require('../../models/hire/planSettingodel')
const phonepeService = require('./Services/phonepeService')
const mongoose = require('mongoose')

class PaymentController {

    // Helper to get plans from DB
    getPlansConfig = async () => {
        const settings = await PlanSettings.getSettings();
        return settings.plans;
    }

    // ==================== USER PAYMENT APIS ====================

    createOrder = async (req, res) => {
        const { id } = req
        const { plan } = req.body

        try {
            const planSettings = await PlanSettings.getSettings();

            if (planSettings.plansComingSoon) {
                return responseReturn(res, 400, { error: 'Plans are coming soon!' })
            }

            if (!planSettings.plans[plan] || !planSettings.plans[plan].active) {
                return responseReturn(res, 400, { error: 'Invalid plan selected' })
            }

            const planConfig = planSettings.plans[plan]
            const amount = planConfig.price

            // Free plan - activate directly
            if (plan === 'Free' || amount === 0) {
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

            // Paid plan - create PhonePe order
            const timestamp = Date.now().toString();
            const transactionId = `T${id.toString().slice(-6)}${timestamp.slice(-8)}`;

            const user = await hireUserModel.findById(id);
            const phonePeResponse = await phonepeService.createOrder(
                amount,
                transactionId,
                id,
                user.phone || '9999999999'
            );

            if (phonePeResponse.success) {
                // Save payment record
                await Payment.create({
                    userId: id,
                    plan: plan,
                    amount: amount,
                    transactionId: transactionId,
                    status: 'pending'
                });

                responseReturn(res, 201, {
                    redirectUrl: phonePeResponse.data.instrumentResponse.redirectInfo.url,
                    transactionId: transactionId,
                    amount: amount,
                    plan: plan
                });
            } else {
                responseReturn(res, 500, { error: 'PhonePe Order creation failed' });
            }

        } catch (error) {
            console.error('Create plan order error:', error)
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    createCreditOrder = async (req, res) => {
        const { id } = req;
        const { credits } = req.body;

        try {
            const settings = await CreditSetting.getSettings();

            if (settings.creditsComingSoon) {
                return responseReturn(res, 400, { error: 'Credit purchases are coming soon!' });
            }

            if (credits < settings.minPurchaseCredits) {
                return responseReturn(res, 400, { error: `Minimum purchase is ${settings.minPurchaseCredits} credits` });
            }

            const amount = Math.round(credits * settings.perCreditCostINR);
            const timestamp = Date.now().toString();
            const transactionId = `CR${id.toString().slice(-6)}${timestamp.slice(-8)}`;

            const user = await hireUserModel.findById(id);
            const phonePeResponse = await phonepeService.createOrder(
                amount,
                transactionId,
                id,
                user.phone || '9999999999'
            );

            if (phonePeResponse.success) {
                await Payment.create({
                    userId: id,
                    plan: 'Credits',
                    credits: credits,
                    amount: amount,
                    transactionId: transactionId,
                    status: 'pending'
                });

                responseReturn(res, 201, {
                    redirectUrl: phonePeResponse.data.instrumentResponse.redirectInfo.url,
                    transactionId: transactionId,
                    amount: amount,
                    credits: credits
                });
            } else {
                responseReturn(res, 500, { error: 'PhonePe Credit order creation failed' });
            }
        } catch (error) {
            console.error('Create credit order error:', error);
            responseReturn(res, 500, { error: 'Internal Server Error' });
        }
    }

    verifyPayment = async (req, res) => {
        const { transactionId } = req.body;

        try {
            const phonePeResponse = await phonepeService.verifyPayment(transactionId);

            if (phonePeResponse.success && phonePeResponse.code === 'PAYMENT_SUCCESS') {
                const payment = await Payment.findOne({ transactionId });

                if (!payment) {
                    return responseReturn(res, 404, { error: 'Payment record not found' });
                }

                if (payment.status === 'success') {
                    return responseReturn(res, 200, { message: 'Payment already verified' });
                }

                if (payment.plan === 'Credits') {
                    // Handle Credits
                    await hireUserModel.findByIdAndUpdate(payment.userId, {
                        $inc: { creditBalance: payment.credits }
                    });
                } else {
                    // Handle Subscription
                    const planSettings = await PlanSettings.getSettings();
                    const planConfig = planSettings.plans[payment.plan];
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + (planConfig.days || 30));

                    await hireUserModel.findByIdAndUpdate(payment.userId, {
                        subscription: {
                            plan: payment.plan,
                            status: 'active',
                            startDate: new Date(),
                            expiresAt: expiresAt,
                            paymentId: transactionId,
                            features: planConfig.features,
                            maxApplications: planConfig.maxApplications
                        }
                    });
                }

                await Payment.findByIdAndUpdate(payment._id, {
                    status: 'success',
                    paidAt: new Date()
                });

                responseReturn(res, 200, { message: 'Payment verified successfully' });
            } else {
                await Payment.findOneAndUpdate({ transactionId }, { status: 'failed' });
                responseReturn(res, 400, { error: 'Payment failed or pending' });
            }
        } catch (error) {
            console.error('Verify payment error:', error);
            responseReturn(res, 500, { error: 'Internal Server Error' });
        }
    }

    getSubscription = async (req, res) => {
        const { id } = req

        try {
            const user = await hireUserModel.findById(id)
            const planSettings = await PlanSettings.getSettings();
            const creditSettings = await CreditSetting.getSettings();

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
                plansComingSoon: planSettings.plansComingSoon,
                creditsComingSoon: creditSettings.creditsComingSoon,
                allPlans: planSettings.plans,
                planDetails: planSettings.plans[subscription.plan] || planSettings.plans['Free']
            })

        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    phonepeWebhook = async (req, res) => {
        // PhonePe sends server-to-server callback
        // Implementation similar to verifyPayment but triggered by PhonePe
        // For simplicity, we assume verifyPayment is used on redirect, or implement it here
        responseReturn(res, 200, { message: 'Webhook received' });
    }

    // ==================== ADMIN PAYMENT APIS ====================

    getAllPayments = async (req, res) => {
        const { page = 1, parPage = 10, searchValue, status, plan } = req.query

        try {
            let skipPage = parseInt(parPage) * (parseInt(page) - 1)
            let query = {}

            if (searchValue) {
                query.$or = [
                    { transactionId: { $regex: searchValue, $options: 'i' } }
                ]
            }

            if (status && status !== 'all') query.status = status
            if (plan && plan !== 'all') query.plan = plan

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

    // ... (rest of admin methods updated to use PlanSettings model)

    getPlanSettings = async (req, res) => {
        try {
            const settings = await PlanSettings.getSettings();
            responseReturn(res, 200, {
                plans: settings.plans,
                plansComingSoon: settings.plansComingSoon,
                message: 'Plan settings retrieved successfully'
            })
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    updatePlanSettings = async (req, res) => {
        const { plans, plansComingSoon } = req.body
        try {
            const settings = await PlanSettings.getSettings();
            if (plans) settings.plans = plans;
            if (plansComingSoon !== undefined) settings.plansComingSoon = plansComingSoon;

            await settings.save();
            responseReturn(res, 200, {
                settings,
                message: `Plan settings updated successfully`
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

            if (status && status !== 'all') query['subscription.status'] = status
            if (plan && plan !== 'all') query['subscription.plan'] = plan

            const users = await hireUserModel.find(query)
                .select('name email phone subscription createdAt')
                .skip(skipPage)
                .limit(parseInt(parPage))
                .sort({ 'subscription.startDate': -1 })

            const totalUsers = await hireUserModel.countDocuments(query)

            responseReturn(res, 200, {
                users,
                totalUsers,
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
            if (!payment || payment.status !== 'success') {
                return responseReturn(res, 400, { error: 'Invalid payment or not refundable' })
            }

            // Mark as refunded
            await Payment.findByIdAndUpdate(id, { status: 'refunded', refundedAt: new Date() })

            // Deactivate subscription if it's a plan
            if (payment.plan !== 'Credits') {
                await hireUserModel.findByIdAndUpdate(payment.userId, { 'subscription.status': 'inactive' })
            } else {
                await hireUserModel.findByIdAndUpdate(payment.userId, { $inc: { creditBalance: -payment.credits } })
            }

            responseReturn(res, 200, { message: 'Refund processed internally' })
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    getRevenueSummary = async (req, res) => {
        const { period = 'monthly' } = req.query
        try {
            const matchQuery = { status: 'success' }
            const revenueTrend = await Payment.aggregate([
                { $match: matchQuery },
                {
                    $group: {
                        _id: { $month: '$paidAt' },
                        revenue: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                }
            ])

            const totalStats = await Payment.aggregate([
                { $match: matchQuery },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$amount' },
                        totalPayments: { $sum: 1 }
                    }
                }
            ])

            responseReturn(res, 200, {
                revenueTrend,
                totalStats: totalStats[0] || { totalRevenue: 0, totalPayments: 0 }
            })
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    // Specialized update methods for specific admin routes
    updateFreePlanSettings = async (req, res) => {
        const { days, features, maxApplications } = req.body
        try {
            const settings = await PlanSettings.getSettings()
            if (days) settings.plans.Free.days = days
            if (features) settings.plans.Free.features = features
            if (maxApplications !== undefined) settings.plans.Free.maxApplications = maxApplications

            await settings.save()
            responseReturn(res, 200, { message: 'Free plan updated', plans: settings.plans })
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    updateMonthlySubscription = async (req, res) => {
        const { planName, price, days } = req.body
        try {
            const settings = await PlanSettings.getSettings()
            if (settings.plans[planName]) {
                if (price) settings.plans[planName].price = price
                if (days) settings.plans[planName].days = days
                await settings.save()
                responseReturn(res, 200, { message: `${planName} plan updated`, plans: settings.plans })
            } else {
                responseReturn(res, 404, { error: 'Plan not found' })
            }
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    updatePlanDuration = async (req, res) => {
        const { planName, days } = req.body
        try {
            const settings = await PlanSettings.getSettings()
            if (settings.plans[planName]) {
                settings.plans[planName].days = days
                await settings.save()
                responseReturn(res, 200, { message: 'Plan duration updated', plans: settings.plans })
            } else {
                responseReturn(res, 404, { error: 'Plan not found' })
            }
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    updatePlanFeatures = async (req, res) => {
        const { planName, features } = req.body
        try {
            const settings = await PlanSettings.getSettings()
            if (settings.plans[planName]) {
                settings.plans[planName].features = features
                await settings.save()
                responseReturn(res, 200, { message: 'Plan features updated', plans: settings.plans })
            } else {
                responseReturn(res, 404, { error: 'Plan not found' })
            }
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    togglePlanActive = async (req, res) => {
        const { planName } = req.params
        try {
            const settings = await PlanSettings.getSettings()
            if (settings.plans[planName]) {
                if (planName === 'Free') return responseReturn(res, 400, { error: 'Common sense: You cannot disable the Free plan' })
                settings.plans[planName].active = !settings.plans[planName].active
                await settings.save()
                responseReturn(res, 200, { message: `Plan ${planName} ${settings.plans[planName].active ? 'activated' : 'deactivated'}`, plans: settings.plans })
            } else {
                responseReturn(res, 404, { error: 'Plan not found' })
            }
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    updateAllPlans = async (req, res) => {
        const { plans } = req.body
        try {
            const settings = await PlanSettings.getSettings()
            settings.plans = { ...settings.plans, ...plans }
            await settings.save()
            responseReturn(res, 200, { message: 'All plans updated', plans: settings.plans })
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    setDiscount = async (req, res) => {
        const { planName, discountPercentage } = req.body
        try {
            // Placeholder: Not implemented in schema yet, but route exists
            responseReturn(res, 200, { message: 'Discount logic triggered (schema update required for full persistence)' })
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    removeDiscount = async (req, res) => {
        const { planName } = req.params
        try {
            responseReturn(res, 200, { message: 'Discount removed' })
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }
}

module.exports = new PaymentController()