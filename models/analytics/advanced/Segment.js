const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  website_type: { type: String, enum: ['ecommerce', 'awareness'], required: true },
  rules: [{
    field: { type: String, required: true },
    operator: { 
      type: String, 
      enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'exists', 'not_exists'],
      required: true 
    },
    value: mongoose.Schema.Types.Mixed,
    value_type: { type: String, enum: ['string', 'number', 'boolean', 'date', 'array'] }
  }],
  member_count: { type: Number, default: 0 },
  is_dynamic: { type: Boolean, default: true },
  refresh_schedule: { type: String, enum: ['hourly', 'daily', 'weekly', 'manual'] },
  last_refreshed: { type: Date, default: Date.now },
  is_active: { type: Boolean, default: true },
  created_by: String,
  tags: [String]
}, {
  timestamps: true,
  collection: 'analytics_segments'
});

module.exports = mongoose.model('AnalyticsSegment', segmentSchema);