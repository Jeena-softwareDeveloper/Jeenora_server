const mongoose = require('mongoose');

const creditSettingSchema = new mongoose.Schema({
    jobApplyCost: { type: Number, default: 5, min: 0 },
    jobApplyEnabled: { type: Boolean, default: true },
    jobApplyType: { type: String, enum: ['Basic', 'Standard', 'Premium'], default: 'Standard' },

    messageSendCost: { type: Number, default: 1, min: 0 },
    messageSendEnabled: { type: Boolean, default: true },
    messageSendType: { type: String, enum: ['Basic', 'Standard', 'Premium'], default: 'Basic' },

    resumeEditCost: { type: Number, default: 50, min: 0 },
    resumeEditEnabled: { type: Boolean, default: true },
    resumeEditType: { type: String, enum: ['Basic', 'Standard', 'Premium'], default: 'Premium' },

    supportInquiryCost: { type: Number, default: 0, min: 0 },
    supportInquiryEnabled: { type: Boolean, default: true },
    supportInquiryType: { type: String, enum: ['Basic', 'Standard', 'Premium'], default: 'Standard' },

    chatEnableCost: { type: Number, default: 10, min: 0 },
    chatEnableEnabled: { type: Boolean, default: true },
    chatEnableType: { type: String, enum: ['Basic', 'Standard', 'Premium'], default: 'Premium' },

    minPurchaseCredits: { type: Number, default: 30, min: 1 },
    perCreditCostINR: { type: Number, default: 1, min: 0.1 },
    initialFreeCredits: { type: Number, default: 0, min: 0 },
    creditsComingSoon: { type: Boolean, default: false },
}, {
    timestamps: true
});

// Ensure only one settings document exists
creditSettingSchema.statics.getSettings = async function () {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
    }
    return settings;
};

module.exports = mongoose.model('CreditSetting', creditSettingSchema);
