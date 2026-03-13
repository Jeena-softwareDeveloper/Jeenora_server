const { Schema, model } = require("mongoose");

const customerSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    phone: {
        type: String,
    },
    image: {
        type: String,
    },
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
    password: {
        type: String,
        required: true,
        select: false
    },
    role: {
        type: String,
        default: 'user'
    },
    method: {
        type: String,
        required: true
    },
    onboarding: {
        language: { type: String },
        gender: { type: String, enum: ['Men', 'Women', 'Kids'] },
        ageGroup: { type: String }
    },
    wallet: {
        balance: { type: Number, default: 0 },
        cashback: { type: Number, default: 0 },
        referralBonus: { type: Number, default: 0 },
        transactions: [{
            type: { type: String, enum: ['credit', 'debit'] },
            amount: { type: Number },
            status: { type: String, enum: ['pending', 'success', 'failed'], default: 'success' },
            reason: { type: String },
            source: { type: String }, // e.g. 'order', 'referral', 'cashback', 'admin'
            date: { type: Date, default: Date.now }
        }]
    },
    devices: [{
        deviceId: String,
        ip: { type: String },
        userAgent: { type: String },
        status: { type: String, default: 'trusted' },
        lastLogin: { type: Date, default: Date.now }
    }],
    recentViewed: [{
        type: Schema.ObjectId,
        ref: 'products'
    }],
    notificationSettings: {
        orderUpdates: { type: Boolean, default: true },
        promotions: { type: Boolean, default: true },
        newArrivals: { type: Boolean, default: true },
        priceDrops: { type: Boolean, default: true },
        emailNotifications: { type: Boolean, default: true },
        smsNotifications: { type: Boolean, default: true },
        pushNotifications: { type: Boolean, default: true }
    },
    privacySettings: {
        profileVisibility: { type: String, enum: ['public', 'private'], default: 'public' },
        showOnlineStatus: { type: Boolean, default: true },
        dataSharing: { type: Boolean, default: false }
    },
    referralCode: {
        type: String,
        unique: true,
        sparse: true
    },
    referredBy: {
        type: Schema.ObjectId,
        ref: 'customer'
    }
}, { timestamps: true })

module.exports = model('customer', customerSchema)