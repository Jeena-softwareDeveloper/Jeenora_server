const Razorpay = require('razorpay');
const crypto = require('crypto');

class RazorpayService {
    get razorpay() {
        if (!this._razorpay) {
            if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
                console.error('RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing from environment variables');
            }
            this._razorpay = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID || 'dummy',
                key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy'
            });
        }
        return this._razorpay;
    }

    createOrder = async (amount, currency = 'INR', receipt) => {
        try {
            const options = {
                amount: Math.round(amount * 100), // amount in the smallest currency unit (paise)
                currency,
                receipt: String(receipt)
            };

            const order = await this.razorpay.orders.create(options);
            return order;
        } catch (error) {
            console.error('Razorpay order creation failed:', error.message || error);
            throw error;
        }
    }

    verifyPayment = (razorpay_order_id, razorpay_payment_id, razorpay_signature) => {
        try {
            if (!process.env.RAZORPAY_KEY_SECRET) throw new Error('RAZORPAY_KEY_SECRET is missing');
            const sign = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSign = crypto
                .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(sign.toString())
                .digest("hex");

            return razorpay_signature === expectedSign;
        } catch (error) {
            console.error('Razorpay verification failed:', error.message);
            return false;
        }
    }
}

module.exports = new RazorpayService();
