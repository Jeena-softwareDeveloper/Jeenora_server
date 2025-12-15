const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // Core identifiers
  transaction_id: { type: String, required: true, unique: true, index: true },
  session_id: { type: String, required: true, index: true },
  user_id: { type: String, required: true, index: true },
  order_id: { type: String, required: true, index: true },
  
  // 🛒 E-COMMERCE & CONVERSION DATA
  timestamp: { type: Date, required: true, index: true },
  
  // Financial data
  revenue: { type: Number, required: true },
  tax: { type: Number, default: 0 },
  shipping: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  
  // Products
  products: [{
    product_id: { type: String, required: true },
    sku: String,
    name: { type: String, required: true },
    category: { type: String, required: true },
    categories: [String],
    brand: String,
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    variant: String
  }],
  
  // Transaction details
  payment_method: String,
  payment_gateway: String,
  shipping_method: String,
  promo_codes: [String],
  
  // Customer information
  customer_email: { type: String, index: true },
  customer_phone: String,
  shipping_country: { type: String, index: true },
  shipping_region: String,
  shipping_city: String,
  
  // 🎪 A/B TESTING & PERSONALIZATION
  experiment_id: String,
  variant_shown: String,
  personalization_rule: String,
  
  // Metadata
  is_refund: { type: Boolean, default: false },
  refund_amount: Number,
  refund_reason: String,
  
  custom_attributes: Map
}, {
  timestamps: true,
  collection: 'ecommerce_transactions'
});

module.exports = mongoose.model('EcommerceTransaction', transactionSchema);