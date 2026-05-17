const { Schema, model } = require("mongoose");
const { isValidTransition } = require("../../utils/orderValidators");

const authSchema = new Schema({
    orderId: {
        type: Schema.ObjectId,
        required: true
    },
    partnerId: {
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
        required: true,
        // No strict enum — B2C uses 'unpaid'/'paid', B2B uses 'Pending'/'Paid'/'Failed'/'Refunded'
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
    return_status: {
        type: String,
        default: 'none' // none, requested, approved, rejected, completed
    },
    return_reason: {
        type: String,
        default: ''
    },
    cancel_reason: {
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
    partnerAmount: {
        type: Number,
        default: 0
    },
    paymentId: {
        type: String
    },
    shiprocket_order_id: { type: String },
    shiprocket_shipment_id: { type: String },
    awb_number: { type: String },
    label_url: { type: String },
    is_high_risk: { type: Boolean, default: false },
    risk_score: { type: Number, default: 0 },
    stock_decreased: { type: Boolean, default: false },

    // 🔹 B2B ORDER FIELDS
    order_type: {
        type: String,
        enum: ['B2C', 'B2B'],
        default: 'B2C'
    },
    // B2B order status flow: New → Paid → Accepted → Packed → Shipped → Delivered
    b2b_status: {
        type: String,
        enum: ['new', 'paid', 'accepted', 'packed', 'shipped', 'delivered', 'cancelled', 'rejected'],
        default: 'new'
    },
    accepted_at: { type: Date, default: null },
    rejection_reason_code: { type: String, default: '' },  // e.g. OUT_OF_STOCK, PRICING_ERROR
    rejection_reason_text: { type: String, default: '' },
    acceptDeadline: { type: Date, default: null },          // 48hr deadline from payment
    autoCancelled: { type: Boolean, default: false },
    cancelled_at: { type: Date, default: null },

    // GST
    gst_amount: { type: Number, default: 0 },
    gst_details: [{
        hsnCode: String,
        gstPercent: Number,
        taxableAmount: Number,
        gstAmount: Number
    }],

    // Cashfree
    cashfree_order_id: { type: String, default: '' },
    cashfree_payment_id: { type: String, default: '' },
    cashfree_payment_time: { type: Date, default: null },
    refund_amount: { type: Number, default: 0 },
    refund_id: { type: String, default: '' }
}, { timestamps: true })

// Index for auto-cancel cron job
authSchema.index({ order_type: 1, b2b_status: 1, acceptDeadline: 1 });

module.exports = model('authorOrders', authSchema)