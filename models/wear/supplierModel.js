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
        gstNumber: { type: String },
        enrolmentId: { type: String },
        panNumber: { type: String },
        panName: { type: String }
    },
    addressDetails: {
        state: { type: String },
        pincode: { type: String },
        district: { type: String },
        city: { type: String },
        addressLine: { type: String },
        street: { type: String },
        landmark: { type: String }
    },
    bankDetails: {
        accountNumber: { type: String },
        confirmAccountNumber: { type: String },
        ifscCode: { type: String },
        bankName: { type: String },
        branchName: { type: String },
        address: { type: String },
        city: { type: String },
        state: { type: String },
        micr: { type: String }
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
