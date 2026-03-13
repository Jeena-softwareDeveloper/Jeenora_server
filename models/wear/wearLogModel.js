const { Schema, model } = require("mongoose");

const wearLogSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'WearBuyer',
        required: false
    },
    phone: {
        type: String,
        required: false
    },
    action: {
        type: String,
        required: true // e.g., 'PAGE_VIEW', 'PRODUCT_CLICK', 'LOGIN'
    },
    details: {
        page: String,
        productId: String,
        productName: String,
        categoryName: String
    },
    device: {
        deviceId: String,
        ip: String,
        userAgent: String,
        platform: String // android, ios, web
    },
    duration: {
        type: Number,
        default: 0 // Duration spent on this action/page in seconds
    },
    sessionId: String, // To group visits
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = model('WearLog', wearLogSchema);
