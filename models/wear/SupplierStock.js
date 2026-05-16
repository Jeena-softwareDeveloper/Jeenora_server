const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
    color: { type: String, required: true },
    colorCode: { type: String, default: '' },
    size: { type: String, required: true },
    stock: { type: Number, required: true, min: 0 },
    reservedStock: { type: Number, default: 0, min: 0 }, // 🔹 ADDED: Reserved for pending orders
    costPrice: { type: Number, required: true },   // private — admin only
    listingPrice: { type: Number, required: true }, // what customer pays
    mrp: { type: Number, required: true },          // printed label price
    lotNumber: { type: String, default: '' },
    manufacturingDate: { type: Date, default: null },
    salesVelocity: { type: Number, default: 0 },          // Units sold per day
    stockoutDate: { type: Date, default: null }           // AI-predicted stockout date
}, { _id: false });

const supplierStockSchema = new mongoose.Schema({
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },

    // Product Identity
    styleName: { type: String, required: true, trim: true }, // Map to product_name
    styleCode: { type: String, required: true, trim: true }, // Map to sku_code
    category: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'WearCategory', index: true }, // Map to category_id
    subCategory: { type: String, default: '' },
    hsnCode: { type: String, required: true },
    gstPercent: { type: Number, required: true }, // auto-filled from HSN, locked

    // Variants
    variants: [variantSchema],

    // Physical Info
    weightGrams: { type: Number, default: 0 },
    lengthCm: { type: Number, default: 0 },
    widthCm: { type: Number, default: 0 },
    heightCm: { type: Number, default: 0 },
    piecesPerCarton: { type: Number, default: 1 },
    minOrderQty: { type: Number, default: 1 },

    // Media
    images: [{ type: String }],

    // Wash / Care
    washCare: { type: String, default: '' },
    fabricDetails: { type: String, default: '' },

    // 🔹 NEW: Inventory Management Fields
    reorderLevel: { type: Number, default: 5 },           // Threshold for low-stock alert
    warehouseLocation: { type: String, default: '' },     // e.g. "Rack A3 / Shelf 2"
    
    // 🔹 AI Fields
    salesVelocity: { type: Number, default: 0 },          // Units sold per day
    stockoutDate: { type: Date, default: null },          // AI-predicted stockout date (stockout_date)
    isDeadStock: { type: Boolean, default: false },       // AI-flagged: 90 days no movement
    lastMovementAt: { type: Date, default: null },         // Last sale/restock timestamp (last_updated_at via updatedAt)
    restockAlertSentAt: { type: Date, default: null },    // Track when last restock alert was sent
    deadStockAlertSentAt: { type: Date, default: null },  // Track when last dead stock alert was sent

    // Status — Dual Mode
    // 'private'         → only supplier sees it (ERP mode)
    // 'pending_approval' → supplier requested to sell, admin reviewing
    // 'active'           → admin approved, live on storefront
    // 'rejected'         → admin rejected with reason
    status: {
        type: String,
        enum: ['private', 'pending_approval', 'active', 'rejected'],
        default: 'private'
    },

    // Linked product in WearProduct collection (once approved)
    linkedProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },

    // Admin review info
    adminNote: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },

    // Supplier note to admin when requesting listing
    supplierNote: { type: String, default: '' },
    listingRequestedAt: { type: Date, default: null },

    // AI Tags (generated on save)
    aiTags: [{ type: String }]
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// 🔹 VIRTUAL: availableStock = stock - reservedStock (per variant)
supplierStockSchema.virtual('variantsAvailable').get(function () {
    return this.variants.map(v => ({
        ...v.toObject(),
        availableStock: Math.max(0, (v.stock || 0) - (v.reservedStock || 0))
    }));
});

// 🔹 VIRTUAL: Total available stock across all variants
supplierStockSchema.virtual('totalAvailableStock').get(function () {
    return this.variants.reduce((sum, v) => sum + Math.max(0, (v.stock || 0) - (v.reservedStock || 0)), 0);
});

// 🔹 VIRTUAL: Total reserved stock across all variants
supplierStockSchema.virtual('totalReservedStock').get(function () {
    return this.variants.reduce((sum, v) => sum + (v.reservedStock || 0), 0);
});

// Index for fast supplier lookup
supplierStockSchema.index({ sellerId: 1, status: 1 });
supplierStockSchema.index({ styleCode: 1 });
supplierStockSchema.index({ isDeadStock: 1 });              // 🔹 NEW: For dead stock queries
supplierStockSchema.index({ stockoutDate: 1 });              // 🔹 NEW: For stockout schedule queries

module.exports = mongoose.model('SupplierStock', supplierStockSchema);