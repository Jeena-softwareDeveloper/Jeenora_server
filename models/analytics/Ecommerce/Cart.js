const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  // Core identifiers
  cart_id: { type: String, required: true, index: true },
  session_id: { type: String, required: true, index: true },
  user_id: { type: String, required: true, index: true },
  
  // Cart actions
  action: { 
    type: String, 
    enum: ['add', 'remove', 'update', 'clear'],
    required: true 
  },
  timestamp: { type: Date, required: true, index: true },
  
  // Product data
  products: [{
    product_id: { type: String, required: true },
    sku: String,
    name: { type: String, required: true },
    category: String,
    brand: String,
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    variant: String
  }],
  
  // Cart totals
  cart_value_before: Number,
  cart_value_after: Number,
  total_quantity: Number,
  
  // Context
  page_url: String,
  source: String, // product page, cart page, etc.
  
  custom_attributes: Map
}, {
  timestamps: true,
  collection: 'ecommerce_cart_actions'
});

module.exports = mongoose.model('EcommerceCart', cartSchema);