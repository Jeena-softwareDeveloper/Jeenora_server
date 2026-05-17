const { Schema, model } = require("mongoose");

const productSchema = new Schema({
    partnerId: {
        type: Schema.ObjectId,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    slug: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    brand: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    stock: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        required: true
    },
    offers: [{
        type: Schema.ObjectId,
        ref: 'ProductOffer'
    }],
    description: {
        type: String,
        required: true
    },
    shopName: {
        type: String,
        required: true
    },
    images: {
        type: Array,
        required: true
    },
    rating: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'pending', 'rejected'],
        default: 'active'
    },
    gstPercentage: {
        type: Number,
        default: 0
    },
    // 🔹 NEW: Inventory Management Fields
    skuId: { type: String },
    reservedStock: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 5 },
    warehouseLocation: { type: String, default: '' },
    stockoutDate: { type: Date, default: null },
    isDeadStock: { type: Boolean, default: false }

}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// 🔹 VIRTUAL: availableStock = stock - reservedStock
productSchema.virtual('availableStock').get(function () {
    return Math.max(0, (this.stock || 0) - (this.reservedStock || 0));
});

productSchema.index({
    name: 'text',
    category: 'text',
    brand: 'text',
    description: 'text'
}, {
    weights: {
        name: 5,
        category: 4,
        brand: 3,
        description: 2
    }

})

const Product = model('Product', productSchema);
model('products', productSchema);
module.exports = Product;