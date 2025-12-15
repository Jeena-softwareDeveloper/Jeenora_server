const mongoose = require('mongoose')

const paymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HireUser',
        required: true
    },
    plan: {
        type: String,
        required: true,
        enum: ['Free', 'Basic', 'Pro', 'Elite']
    },
    amount: {
        type: Number,
        required: true
    },
    razorpayOrderId: {
        type: String,
        required: true
    },
    razorpayPaymentId: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed', 'refunded'],
        default: 'pending'
    },
    paidAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
})

module.exports = mongoose.model('Payment', paymentSchema)