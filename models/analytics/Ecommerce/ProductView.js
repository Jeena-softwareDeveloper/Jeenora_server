const mongoose = require('mongoose');

const productViewSchema = new mongoose.Schema({
  // Core identifiers
  view_id: { type: String, required: true, unique: true, index: true },
  session_id: { type: String, required: true, index: true },
  user_id: { type: String, required: true, index: true },
  
  // Product data
  product_id: { type: String, required: true, index: true },
  product_name: { type: String, required: true },
  sku: { type: String, index: true },
  category: { type: String, index: true },
  categories: [String],
  brand: { type: String, index: true },
  
  // Pricing
  price: { type: Number, required: true },
  original_price: { type: Number },
  currency: { type: String, default: 'USD' },
  
  // Stock & availability
  stock_status: { type: String, enum: ['in_stock', 'out_of_stock', 'low_stock'] },
  stock_quantity: Number,
  
  // View metrics
  timestamp: { type: Date, required: true, index: true },
  time_on_product: Number,
  scroll_depth: Number,
  images_viewed: [String],
  
  // Context
  page_url: String,
  referrer_url: String,
  list_position: Number, // Position in product listing
  list_type: String, // search, category, related, etc.
  
  // User interaction
  added_to_cart: { type: Boolean, default: false },
  added_to_wishlist: { type: Boolean, default: false },
  
  custom_attributes: Map
}, {
  timestamps: true,
  collection: 'ecommerce_product_views'
});

module.exports = mongoose.model('EcommerceProductView', productViewSchema);