const mongoose = require('mongoose');

const wearNotificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WearBuyer', // The supplier is also a WearBuyer
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['system', 'offer', 'order', 'account'],
        default: 'system'
    },
    category: {
        type: String,
        default: 'General'
    },
    isRead: {
        type: Boolean,
        default: false,
        index: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed // Optional: link to campaign, order, etc.
    }
}, { timestamps: true });

module.exports = mongoose.model('WearNotification', wearNotificationSchema);
