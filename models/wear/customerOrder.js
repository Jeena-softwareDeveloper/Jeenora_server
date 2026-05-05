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
    },
    shiprocket_order_id: { type: String },
    shiprocket_shipment_id: { type: String },
    awb_number: { type: String },
    label_url: { type: String },
    is_high_risk: { type: Boolean, default: false },
    risk_score: { type: Number, default: 0 }
}, { timestamps: true })

module.exports = model('customerOrders', customerOrder)