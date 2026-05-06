const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
    color: { type: String, required: true },
    colorCode: { type: String, default: '' },
    size: { type: String, required: true },
    stock: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, required: true },   // private — admin only
    listingPrice: { type: Number, required: true }, // what customer pays
    mrp: { type: Number, required: true },          // printed label price
    lotNumber: { type: String, default: '' },
    manufacturingDate: { type: Date, default: null }
}, { _id: false });

const supplierStockSchema = new mongoose.Schema({
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },

    // Product Identity
    styleName: { type: String, required: true, trim: true },
    styleCode: { type: String, required: true, trim: true },
    category: { type: String, required: true },
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
}, { timestamps: true });

// Index for fast supplier lookup
supplierStockSchema.index({ supplierId: 1, status: 1 });
supplierStockSchema.index({ styleCode: 1 });

module.exports = mongoose.model('SupplierStock', supplierStockSchema);
