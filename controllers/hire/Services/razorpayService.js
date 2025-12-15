const Razorpay = require('razorpay')
const crypto = require('crypto')

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
})

class RazorpayService {
    
    createOrder = async (amount, receipt) => {
        try {
            const options = {
                amount: amount * 100, // Convert to paise
                currency: "INR",
                receipt: receipt,
                payment_capture: 1
            }

            console.log('Razorpay order options:', {
                amount: options.amount,
                currency: options.currency,
                receipt: options.receipt,
                receipt_length: options.receipt.length
            })

            const order = await razorpay.orders.create(options)
            console.log('Razorpay order created successfully:', order.id)
            return order
        } catch (error) {
            console.error('Razorpay order creation failed:', {
                error: error.error,
                statusCode: error.statusCode,
                description: error.error?.description
            })
            throw error
        }
    }

    verifySignature = (order_id, payment_id, signature) => {
        try {
            const body = order_id + "|" + payment_id
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(body.toString())
                .digest('hex')

            const isValid = expectedSignature === signature
            console.log('Signature verification:', { isValid, order_id })
            return isValid
        } catch (error) {
            console.error('Signature verification error:', error)
            return false
        }
    }

    verifyWebhookSignature = (webhookBody, signature) => {
        try {
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
                .update(webhookBody)
                .digest('hex')

            return expectedSignature === signature
        } catch (error) {
            console.error('Webhook verification error:', error)
            return false
        }
    }
}

module.exports = new RazorpayService()