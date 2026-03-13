const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  event_id: { 
    type: String, 
    required: true, 
    unique: true 
  },
  user_id: { 
    type: String, 
    required: true, 
    index: true 
  },
  session_id: { 
    type: String, 
    required: true, 
    index: true 
  },
  event_type: { 
    type: String, 
    required: true, 
    index: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now, 
    index: true 
  },
  duration: { 
    type: Number, 
    default: 0 
  },
  metadata: mongoose.Schema.Types.Mixed,
  
  created_at: { 
    type: Date, 
    default: Date.now 
  }
});

eventSchema.index({ user_id: 1, timestamp: -1 });
eventSchema.index({ session_id: 1, timestamp: -1 });
eventSchema.index({ event_type: 1, timestamp: -1 });

module.exports = mongoose.model('Event', eventSchema);