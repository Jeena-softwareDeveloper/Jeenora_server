const mongoose = require('mongoose');

const wearBuyerSchema = new mongoose.Schema({
    name: {
        type: String,
        default: 'Guest'
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: { 
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    phone: {
        type: String,
    },
    image: { type: String },
    gender: { type: String },
    languages: { type: String },
    occupation: { type: String },
    dob: { type: String },
    maritalStatus: { type: String },
    kidsCount: { type: String },
    education: { type: String },
    monthlyIncome: { type: String },
    businessName: { type: String },
    pincode: { type: String },
    city: { type: String },
    state: { type: String },
    isVerified: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        default: 'wear_buyer'
    },
    devices: {
        type: [{
            deviceId: String,
            ip: { type: String },
            userAgent: { type: String },
            status: { type: String, default: 'trusted' }, // trusted, untrusted
            lastLogin: { type: Date, default: Date.now }
        }],
        select: false
    },
    referralCode: {
        type: String,
        unique: true,
        sparse: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WearBuyer',
        select: false
    },
    codDisabled: {
        type: Boolean,
        default: false  // set to true by admin when user has high COD cancel rate
    },
    recentViewed: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WearProduct'
    }]
}, { timestamps: true });

module.exports = mongoose.model('WearBuyer', wearBuyerSchema);
