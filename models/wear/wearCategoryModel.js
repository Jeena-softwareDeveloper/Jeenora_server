const mongoose = require('mongoose');

const wearCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String,
        required: true
    },
    slug: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WearCategory',
        default: null
    },
    level: {
        type: Number,
        default: 0 // 0: Main, 1: Sub, 2: Leaf
    },
    additionalDetails: [{
        name: { type: String, required: true }, // e.g., "Neck Type", "Sleeve Styling"
        required: { type: Boolean, default: false },
        type: { type: String, default: 'text' },
        isFilter: { type: Boolean, default: false },
        isList: { type: Boolean, default: false },
        options: [String]
    }],
    priority: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

wearCategorySchema.index({ name: 'text' });

module.exports = mongoose.model('WearCategory', wearCategorySchema);
