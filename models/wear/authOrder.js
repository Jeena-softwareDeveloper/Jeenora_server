const { Schema, model } = require("mongoose");
const { isValidTransition } = require("../../utiles/orderValidators");

const authSchema = new Schema({
    orderId: {
        type: Schema.ObjectId,
        required: true
    },
    sellerId: {
        type: Schema.ObjectId,
        required: true
    },
    products: {
        type: Array,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    payment_status: {
        type: String,
        required: true
    },
    shippingInfo: {
        type: String,
        required: true
    },
    delivery_status: {
        type: String,
        required: true,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
        validate: {
            validator: function (v) {
                if (this.isNew) return v === 'pending';
                return isValidTransition(this.delivery_status, v);
            }
        }
    },
    return_status: {
        type: String,
        default: 'none' // none, requested, approved, rejected, completed
    },
    return_reason: {
        type: String,
        default: ''
    },
    date: {
        type: String,
        required: true
    },
    commissionRate: {
        type: Number,
        default: 0
    },
    commissionAmount: {
        type: Number,
        default: 0
    },
    sellerAmount: {
        type: Number,
        default: 0
    },
    paymentId: {
        type: String
    }
}, { timestamps: true })

module.exports = model('authorOrders', authSchema)