const mongoose = require('mongoose');

const productOfferSchema = new mongoose.Schema({
    offerName: { type: String, required: true }, // e.g., "Bank Offer 5%", "UPI 20 Off"
    tag: { type: String, required: true },       // e.g., "BANK OFFER"
    title: { type: String, required: true },     // e.g., "5% Cashback on Jeenora Cards"
    subtitle: { type: String, required: true },  // e.g., "No minimum order value required"
    icon: { type: String, default: "bank" },     // MaterialCommunityIcon name
    iconColor: { type: String, default: "#1D4ED8" },
    colors: [{ type: String }],                  // e.g., ['#EFF6FF', '#DBEAFE'] for Gradient
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, { timestamps: true });

module.exports = mongoose.model('ProductOffer', productOfferSchema);
