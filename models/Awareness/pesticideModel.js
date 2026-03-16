const mongoose = require('mongoose');

const pesticideSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, enum: ['Biological', 'Chemical', 'Organic', 'Preventive'], required: true },
    description: { type: String, required: true },
    image: { type: String, required: true },
    effectiveness_rating: { type: Number, default: 4 },
    safetyRating: { type: String, default: 'Safe' },
    pest_targets: [{ type: String }],
    application_type: { type: String, default: 'Spray' },
    usage_guide: { type: String },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('AwarenessPesticide', pesticideSchema);
