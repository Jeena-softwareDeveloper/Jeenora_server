const mongoose = require('mongoose');

const tickerSchema = new mongoose.Schema({
    text: { type: String, required: true },
    type: { type: String, enum: ['info', 'urgent', 'success'], default: 'info' },
    link: { type: String },
    isActive: { type: Boolean, default: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('AwarenessTicker', tickerSchema);
