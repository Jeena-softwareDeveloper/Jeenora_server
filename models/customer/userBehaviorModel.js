const mongoose = require('mongoose');

const userBehaviorSchema = new mongoose.Schema({
    userId: { type: String, default: 'Guest' },
    deviceId: { type: String }, // To track unique guests
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'products' },
    category: { type: String },
    referrer: { type: String },
    viewDuration: { type: Number, default: 0 }, // in seconds
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('userBehaviors', userBehaviorSchema);
