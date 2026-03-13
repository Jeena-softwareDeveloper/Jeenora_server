const mongoose = require('mongoose');

const wearSearchHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WearBuyer',
        index: true
    },
    deviceId: {
        type: String,
        index: true
    },
    query: {
        type: String,
        required: true,
        trim: true
    },
    count: {
        type: Number,
        default: 1
    }
}, { timestamps: true });

// Index for getting trending searches
wearSearchHistorySchema.index({ query: 1 });
wearSearchHistorySchema.index({ createdAt: -1 });

module.exports = mongoose.model('WearSearchHistory', wearSearchHistorySchema);
