const mongoose = require('mongoose');

const aiLogSchema = new mongoose.Schema({
    userId: { type: String, default: 'Guest/System' },
    role: { type: String, enum: ['admin', 'supplier', 'customer', 'guest', 'system', 'user'], default: 'system' },
    featureName: { type: String, required: true },
    promptOrContext: { type: String },
    aiResponse: { type: Object }, // Store the parsed JSON or raw text
}, { timestamps: true });

module.exports = mongoose.model('ailogs', aiLogSchema);
