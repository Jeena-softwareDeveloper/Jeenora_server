const mongoose = require('mongoose');

const wearProductSchema = new mongoose.Schema({
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: true
    },
    catalogId: {
        type: String, // Random ID to group similar products together
        index: true
    },
    productName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    miniDescription: {
        type: String
    },
    detailedDescription: {
        type: String
    },
    alterSlug: [{
        type: String // Optional custom slug overrides
    }],
    isPrimary: {
        type: Boolean,
        default: false
    },
    category: {
        type: String, // e.g., "Sarees"
        required: true
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WearCategory',
        index: true
    },
    subCategory: {
        type: String // e.g., "Banarasi Sarees"
    },
    subCategoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WearCategory',
        index: true
    },
    images: [{
        type: String // URLs or base64 for now
    }],
    supplierType: {
        type: String,
        enum: ['Manufacturer', 'Wholesaler', 'Retailer', 'Brand', ''],
        default: ''
    },
    tags: [{
        type: String,
        index: true
    }],
    isBulkOnly: {
        type: Boolean,
        default: false
    },

    // Meesho-style Pricing & Tax
    hsnCode: { type: String },
    gstPercentage: { type: Number, default: 5 }, // 5%, 12%, 18% etc.

    // Shipping Details
    weight: { type: Number }, // in grams
    dimensions: {
        length: { type: Number },
        width: { type: Number },
        height: { type: Number }
    },
    minOrderQty: {
        type: Number,
        default: 1
    },

    // Attributes (Stored with metadata for richer UI display)
    attributes: [{
        name: { type: String },
        value: { type: String },
        type: { type: String, default: 'text' } // 'text' or 'number'
    }],

    // Variants (Size/Color/Price/Stock)
    variants: [{
        size: { type: String }, // S, M, L, XL, Free Size
        color: { type: String },
        listingPrice: { type: Number, required: true }, // Default/Single item price
        mrp: { type: Number }, // Original price
        stock: { type: Number, required: true, default: 0 },
        skuId: { type: String },
        priceTiers: [{
            minQty: { type: Number, required: true },
            price: { type: Number, required: true }
        }]
    }],

    status: {
        type: String,
        enum: ['pending', 'active', 'inactive', 'rejected'],
        default: 'pending'
    },
    adminComment: { type: String },
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WearOfferCampaign',
        index: true
    },
    offerData: {
        originalProductName: String,
        originalVariants: Array,
        isCustomizedForOffer: { type: Boolean, default: false }
    },
    offers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductOffer'
    }],
    isFeatured: {
        type: Boolean,
        default: false
    },
    featuredPriority: {
        type: Number,
        default: 0
    },
    isModerated: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Text indices for search
wearProductSchema.index({
    productName: 'text',
    category: 'text',
    description: 'text'
});

// Index for SKU (uniqueness per variant)
wearProductSchema.index({ "variants.skuId": 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('WearProduct', wearProductSchema);
