const mongoose = require('mongoose');

const awarenessCampaignSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Completed', 'Upcoming'], default: 'Active' },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    location: { type: String },
    participants: { type: Number, default: 0 },
    isHot: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('AwarenessSocialCampaign', awarenessCampaignSchema);
