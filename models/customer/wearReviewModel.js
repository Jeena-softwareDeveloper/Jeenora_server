const mongoose = require('mongoose');

const wearReviewSchema = new mongoose.Schema({
    catalogId: {
        type: String,
        required: true,
        index: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WearProduct',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WearBuyer',
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    reviewText: {
        type: String,
        required: true
    },
    images: [{
        type: String // URLs to review images
    }],
    helpful: {
        type: Number,
        default: 0
    },
    verified: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['active', 'deactive'],
        default: 'active'
    }
}, { timestamps: true });

// Index for faster queries
wearReviewSchema.index({ catalogId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('WearReview', wearReviewSchema);
