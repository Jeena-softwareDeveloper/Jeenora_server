const mongoose = require('mongoose');

const funnelSchema = new mongoose.Schema({
  funnel_id: {
    type: String,
    required: true,
    unique: true
  },
  user_id: {
    type: String,
    required: true
  },
  start_time: {
    type: Date,
    required: true,
    default: Date.now
  },
  events_tracked: [{
    event_type: String,
    timestamp: Date,
    event_id: String,
    metadata: Object
  }],
  conversion: {
    type: Boolean,
    default: false
  },
  conversion_value: {
    type: Number,
    default: 0
  },
  completed_at: Date,
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

funnelSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

funnelSchema.index({ user_id: 1, start_time: -1 });
funnelSchema.index({ conversion: 1 });

module.exports = mongoose.model('Funnel', funnelSchema);