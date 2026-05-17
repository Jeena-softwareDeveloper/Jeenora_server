const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WearBuyer',
        required: true
    },
    businessDetails: {
        shopName: { type: String, required: true },
        businessType: { type: String, required: true },
        hasGst: { type: Boolean, default: false },
        gstNumber: { type: String, select: false },
        enrolmentId: { type: String, select: false },
        panNumber: { type: String, select: false },
        panName: { type: String, select: false }
    },
    addressDetails: {
        state: { type: String, select: false },
        pincode: { type: String, select: false },
        district: { type: String, select: false },
        city: { type: String, select: false },
        addressLine: { type: String, select: false },
        street: { type: String, select: false },
        landmark: { type: String, select: false }
    },
    bankDetails: {
        accountNumber: { type: String, select: false },
        confirmAccountNumber: { type: String, select: false },
        ifscCode: { type: String, select: false },
        bankName: { type: String, select: false },
        branchName: { type: String, select: false },
        address: { type: String, select: false },
        city: { type: String, select: false },
        state: { type: String, select: false },
        micr: { type: String, select: false }
    },
    supplierDetails: {
        fullName: { type: String },
        email: { type: String },
        phone: { type: String }
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'suspended'],
        default: 'pending'
    },
    hasShownCongrats: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Supplier', supplierSchema);
