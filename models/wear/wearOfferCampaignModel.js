const mongoose = require('mongoose');

const wearOfferCampaignSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date
    },
    status: {
        type: String,
        enum: ['upcoming', 'active', 'expired', 'closed'],
        default: 'active'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Useful for tracking which suppliers should see this or if it was sent
    notificationSent: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('WearOfferCampaign', wearOfferCampaignSchema);
