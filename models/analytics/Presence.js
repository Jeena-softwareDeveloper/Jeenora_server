const mongoose = require('mongoose');

const presenceSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true
  },
  session_id: {
    type: String,
    required: true
  },
  page_url: String,
  last_ping: {
    type: Date,
    required: true,
    default: Date.now
  },
  is_active: {
    type: Boolean,
    default: true
  },
  idle_time: {
    type: Number,
    default: 0
  },
  device_type: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet'],
    required: true
  },
  location: {
    country: String,
    city: String
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

presenceSchema.index({ last_ping: -1 });
presenceSchema.index({ is_active: 1 });

module.exports = mongoose.model('Presence', presenceSchema);