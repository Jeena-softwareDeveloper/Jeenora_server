const { Schema, model } = require('mongoose')
const { isValidTransition } = require('../../utiles/orderValidators')

const customerOrder = new Schema({
    customerId: {
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
        type: Object,
        required: true
    },
    delivery_status: {
        type: String,
        required: true,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
        validate: {
            validator: function (v) {
                // 'this.isNew' allows the initial 'pending' state
                if (this.isNew) return v === 'pending';

                // For updates via .save(), enforce state machine
                return isValidTransition(this.delivery_status, v);
            }
        }
    },
    date: {
        type: String,
        required: true
    },
    totalCommission: {
        type: Number,
        default: 0
    },
    paymentId: {
        type: String
    }
}, { timestamps: true })

module.exports = model('customerOrders', customerOrder)