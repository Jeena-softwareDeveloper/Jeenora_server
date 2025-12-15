const mongoose = require('mongoose');

const dataLakeSchema = new mongoose.Schema({
  event_id: {
    type: String,
    required: true,
    unique: true
  },
  user_id: String,
  session_id: String,
  raw_event_data: {
    type: Object,
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  metadata: {
    page_url: String,
    user_agent: String,
    ip_address: String,
    screen_resolution: String,
    language: String
  },
  processed: {
    type: Boolean,
    default: false
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

dataLakeSchema.index({ timestamp: -1 });
dataLakeSchema.index({ processed: 1 });

module.exports = mongoose.model('DataLake', dataLakeSchema);