const mongoose = require('mongoose');

const pageSequenceSchema = new mongoose.Schema({
  page_url: String,
  page_title: String,
  duration: { 
    type: Number, 
    default: 0
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  referrer: {
    url: String,
    source: String,
    medium: String,
    campaign: String
  }
});

const sessionSchema = new mongoose.Schema({
  session_id: { 
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
  end_time: Date,
  duration: { 
    type: Number, 
    default: 0
  },
  last_activity: { 
    type: Date, 
    default: Date.now 
  },
  page_sequence: [pageSequenceSchema],
  referrer: {
    url: String,
    source: String,
    medium: String,
    campaign: String
  },
  device_snapshot: {
    os: String,
    browser: String,
    device_type: String,
    screen_resolution: String,
    language: String
  },
  location_snapshot: {
    country: { type: String, default: 'Unknown' },
    city: { type: String, default: 'Unknown' },
    region: { type: String, default: 'Unknown' },
    timezone: { type: String, default: 'Asia/Calcutta' },
    ip: { type: String, default: 'Unknown' },
    latitude: Number,
    longitude: Number
  },
  is_active: { 
    type: Boolean, 
    default: true 
  }
}, { 
  timestamps: true 
});

sessionSchema.methods.calculateDuration = function() {
  const endTime = this.end_time || new Date();
  const durationMs = endTime - this.start_time;
  return Math.round(durationMs / 1000);
};

sessionSchema.pre('save', function(next) {
  if (this.isModified('end_time') || this.isModified('is_active') || !this.duration) {
    this.duration = this.calculateDuration();
  }
  next();
});

sessionSchema.index({ user_id: 1, start_time: -1 });
sessionSchema.index({ start_time: -1 });
sessionSchema.index({ last_activity: -1 });
sessionSchema.index({ is_active: 1 });

module.exports = mongoose.model('Session', sessionSchema);