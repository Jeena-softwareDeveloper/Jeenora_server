const mongoose = require('mongoose');

const marketPriceSchema = new mongoose.Schema({
  cropName: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    default: 'kg'
  },
  change: {
    type: Number,
    default: 0
  },
  market: {
    type: String,
    default: 'Main Market'
  },
  state: {
    type: String,
    default: 'Tamil Nadu'
  }
}, { timestamps: true });

module.exports = mongoose.model('MarketPrice', marketPriceSchema);
