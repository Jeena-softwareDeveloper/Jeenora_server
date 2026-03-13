const mongoose = require('mongoose')

const planSettingsSchema = new mongoose.Schema({
    plans: {
        Free: {
            price: { type: Number, default: 0 },
            days: { type: Number, default: 7 },
            active: { type: Boolean, default: true },
            description: { type: String, default: 'Basic plan for getting started' },
            features: [{ type: String }],
            maxApplications: { type: Number, default: 3 }
        },
        Basic: {
            price: { type: Number, default: 199 },
            days: { type: Number, default: 30 },
            active: { type: Boolean, default: true },
            description: { type: String, default: 'Standard plan for regular users' },
            features: [{ type: String }],
            maxApplications: { type: Number, default: 10 }
        },
        Pro: {
            price: { type: Number, default: 499 },
            days: { type: Number, default: 90 },
            active: { type: Boolean, default: true },
            description: { type: String, default: 'Professional plan for serious job seekers' },
            features: [{ type: String }],
            maxApplications: { type: Number, default: 0 } // 0 means unlimited
        },
        Elite: {
            price: { type: Number, default: 999 },
            days: { type: Number, default: 180 },
            active: { type: Boolean, default: true },
            description: { type: String, default: 'Premium plan with exclusive features' },
            features: [{ type: String }],
            maxApplications: { type: Number, default: 0 }
        }
    },
    plansComingSoon: { type: Boolean, default: true }
}, {
    timestamps: true
})

// Ensure only one document exists
planSettingsSchema.statics.getSettings = async function () {
    let settings = await this.findOne()
    if (!settings) {
        settings = await this.create({})
        // Initialize default features
        settings.plans.Free.features = ['Basic alerts', '3 Job Applications']
        settings.plans.Basic.features = ['Unlimited job alerts', '10 Job Applications', 'Resume Download']
        settings.plans.Pro.features = ['Priority alerts', 'Unlimited Applications', 'Featured Profile']
        settings.plans.Elite.features = ['AI resume', 'VIP alerts', 'Dedicated Support']
        await settings.save()
    }
    return settings
}

module.exports = mongoose.model('PlanSettings', planSettingsSchema)