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
    payment_method: {
        type: String,
        required: true,
        enum: ['COD', 'ONLINE']
    },
    shippingInfo: {
        type: Object,
        required: true
    },
    delivery_status: {
        type: String,
        required: true,
        enum: ['pending_payment', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
        validate: {
            validator: function (v) {
                // 'this.isNew' allows the initial 'pending' or 'pending_payment' states
                if (this.isNew) return ['pending', 'pending_payment'].includes(v);

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
    },
    cartItemIds: {
        type: [Schema.ObjectId],
        default: []
    }
}, { timestamps: true })

module.exports = model('customerOrders', customerOrder)