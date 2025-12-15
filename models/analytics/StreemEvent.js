const mongoose = require('mongoose');

const streamEventSchema = new mongoose.Schema({
  event_id: {
    type: String,
    required: true,
    unique: true
  },
  user_id: String,
  event_type: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  stream_source: {
    type: String,
    required: true,
    enum: ['kafka', 'kinesis', 'pubsub', 'direct']
  },
  processing_status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  event_data: {
    type: Object,
    required: true
  },
  processed_at: Date,
  error_message: String,
  created_at: {
    type: Date,
    default: Date.now
  }
});

streamEventSchema.index({ timestamp: -1 });
streamEventSchema.index({ processing_status: 1 });
streamEventSchema.index({ stream_source: 1 });

module.exports = mongoose.model('StreamEvent', streamEventSchema);