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
        required: true
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
        balance: { type: Number, default: 0, select: false },
        cashback: { type: Number, default: 0, select: false },
        referralBonus: { type: Number, default: 0, select: false },
        transactions: { 
            type: [{
                type: { type: String, enum: ['credit', 'debit'] },
                amount: { type: Number },
                status: { type: String, enum: ['pending', 'success', 'failed'], default: 'success' },
                reason: { type: String },
                source: { type: String },
                date: { type: Date, default: Date.now }
            }],
            select: false
        }
    },
    devices: {
        type: [{
            deviceId: String,
            ip: { type: String },
            userAgent: { type: String },
            status: { type: String, default: 'trusted' },
            lastLogin: { type: Date, default: Date.now }
        }],
        select: false
    },
    recentViewed: {
        type: [{
            type: Schema.ObjectId,
            ref: 'products'
        }],
        select: false
    },
    notificationSettings: {
        orderUpdates: { type: Boolean, default: true, select: false },
        promotions: { type: Boolean, default: true, select: false },
        newArrivals: { type: Boolean, default: true, select: false },
        priceDrops: { type: Boolean, default: true, select: false },
        emailNotifications: { type: Boolean, default: true, select: false },
        smsNotifications: { type: Boolean, default: true, select: false },
        pushNotifications: { type: Boolean, default: true, select: false }
    },
    privacySettings: {
        profileVisibility: { type: String, enum: ['public', 'private'], default: 'public', select: false },
        showOnlineStatus: { type: Boolean, default: true, select: false },
        dataSharing: { type: Boolean, default: false, select: false }
    },
    referralCode: {
        type: String,
        unique: true,
        sparse: true
    },
    referredBy: {
        type: Schema.ObjectId,
        ref: 'customer',
        select: false
    }
}, { timestamps: true })

module.exports = model('customer', customerSchema)