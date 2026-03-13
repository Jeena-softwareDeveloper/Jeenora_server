const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  website_type: { type: String, enum: ['ecommerce', 'awareness'], required: true },
  user_id: { type: String, required: true, index: true },
  session_id: { type: String, required: true, index: true },
  event_type: { type: String, required: true },
  event_name: { type: String, required: true },
  value: { type: Number, default: 0 },
  funnel_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AnalyticsFunnel' },
  funnel_step: { type: Number },
  properties: Map,
  is_conversion: { type: Boolean, default: false },
  conversion_value: { type: Number, default: 0 }
}, {
  timestamps: true,
  collection: 'analytics_goals'
});

module.exports = mongoose.model('AnalyticsGoal', goalSchema);