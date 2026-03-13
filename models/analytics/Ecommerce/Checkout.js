const mongoose = require('mongoose');

const checkoutSchema = new mongoose.Schema({
  // Core identifiers
  checkout_id: { type: String, required: true, unique: true, index: true },
  session_id: { type: String, required: true, index: true },
  user_id: { type: String, required: true, index: true },
  
  // 📈 CONVERSION FUNNEL DATA
  funnel_name: { type: String, default: 'purchase' },
  funnel_step: { type: Number, required: true },
  step_name: { type: String, required: true },
  
  // Step timing
  timestamp: { type: Date, required: true, index: true },
  step_start_time: Date,
  step_completion_time: Number, // seconds
  
  // Step data
  step_data: {
    // Contact information
    email: String,
    phone: String,
    
    // Shipping
    shipping_method: String,
    shipping_cost: Number,
    shipping_address: {
      country: String,
      region: String,
      city: String,
      postal_code: String
    },
    
    // Payment
    payment_method: String,
    payment_gateway: String,
    
    // Order review
    items: [{
      product_id: String,
      name: String,
      quantity: Number,
      price: Number
    }],
    
    // Promotions
    promo_codes: [String],
    discount_amount: Number
  },
  
  // Drop-off tracking
  is_drop_off: { type: Boolean, default: false },
  drop_off_reason: String,
  back_navigation: { type: Boolean, default: false },
  
  custom_attributes: Map
}, {
  timestamps: true,
  collection: 'ecommerce_checkout_steps'
});

module.exports = mongoose.model('EcommerceCheckout', checkoutSchema);