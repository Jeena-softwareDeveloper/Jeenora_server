const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  pointCost: {
    type: Number,
    required: true
  },
  icon: {
    type: String,
    default: 'Gift'
  },
  type: {
    type: String,
    enum: ['voucher', 'pesticide_sample', 'consultation', 'badge'],
    default: 'voucher'
  }
}, { timestamps: true });

module.exports = mongoose.model('Reward', rewardSchema);
