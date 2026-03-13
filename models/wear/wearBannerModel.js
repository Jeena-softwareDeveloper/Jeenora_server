const mongoose = require('mongoose');

const wearBannerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String, // Banner image URL
        required: true
    },
    bannerType: {
        type: String,
        enum: ['mini', 'hero', 'grid', 'strip'],
        default: 'mini' // Maha Sale mini size is requested
    },
    // Targeted Placement (Mapping to Offer Zones)
    offerZones: [{
        type: String, // Can be Campaign ID or 'home'
    }],
    // Filter Targeting (Logic-based)
    filters: {
        brand: [String],
        priceRange: {
            min: Number,
            max: Number
        },
        gender: {
            type: String,
            enum: ['Men', 'Women', 'Kids', 'All'],
            default: 'All'
        },
        ageGroup: {
            type: String, // e.g., '18-24', '25-34' etc.
            default: 'All'
        },
        attributes: [{
            name: String,
            value: String
        }]
    },
    // Direct Reference to specific Catalogs/Product Groups
    catalogId: [String],
    // Action when clicked
    actionType: {
        type: String,
        enum: ['category', 'product', 'external_link', 'search', 'campaign', 'none'],
        required: true
    },
    actionValue: {
        type: String, // Slug, ID, or URL
        required: true
    },
    // UI/UX & Priority
    priority: {
        type: Number,
        default: 0 // Higher is shown first
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    // Sponsorship & Analytics (Future-proofing)
    sponsoredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        default: null
    },
    analytics: {
        views: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 }
    }
}, { timestamps: true });

// Indices for performance
wearBannerSchema.index({ offerZones: 1, isActive: 1, priority: -1 });
wearBannerSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('WearBanner', wearBannerSchema);
