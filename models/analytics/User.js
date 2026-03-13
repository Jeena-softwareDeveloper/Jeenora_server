const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  user_id: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  anonymous_id: { 
    type: String, 
    index: true, 
    sparse: true 
  },
  
  first_seen_at: { 
    type: Date, 
    default: Date.now 
  },
  last_seen_at: { 
    type: Date, 
    default: Date.now 
  },
  last_active_at: { 
    type: Date, 
    default: Date.now 
  },
  
  is_online: { 
    type: Boolean, 
    default: false, 
    index: true 
  },
  status: { 
    type: String, 
    enum: ['new', 'returning'], 
    default: 'new', 
    index: true 
  },
  
  referrer: {
    url: String,
    source: String,
    medium: String,
    campaign: String,
    hostname: String,
    is_direct: Boolean
  },
  
  device: {
    os: String,
    browser: String,
    device_type: String,
    screen_resolution: String,
    language: String
  },
  
  location: {
    country: { type: String, default: 'Unknown' },
    city: { type: String, default: 'Unknown' },
    region: { type: String, default: 'Unknown' },
    timezone: { type: String, default: 'Asia/Calcutta' },
    ip: { type: String, default: 'Unknown' },
    latitude: Number,
    longitude: Number
  },
  
  engagement: {
    total_sessions: { 
      type: Number, 
      default: 0 
    },
    total_time_spent: { 
      type: Number, 
      default: 0
    },
    total_events: { 
      type: Number, 
      default: 0 
    },
    avg_session_time: { 
      type: Number, 
      default: 0
    },
    last_session_at: Date
  },
  
  created_at: { 
    type: Date, 
    default: Date.now 
  },
  updated_at: { 
    type: Date, 
    default: Date.now 
  }
});

userSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

userSchema.virtual('activity_status').get(function () {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.last_active_at >= fiveMinutesAgo ? 'active' : 'offline';
});

userSchema.methods.updateEngagementMetrics = async function() {
  const Session = mongoose.model('Session');
  
  const sessionStats = await Session.aggregate([
    { $match: { user_id: this.user_id } },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        totalTimeSpent: { $sum: '$duration' },
        avgSessionTime: { $avg: '$duration' }
      }
    }
  ]);

  const stats = sessionStats[0] || {};
  
  this.engagement.total_sessions = stats.totalSessions || 0;
  this.engagement.total_time_spent = stats.totalTimeSpent || 0;
  this.engagement.avg_session_time = stats.avgSessionTime || 0;
  
  await this.save();
};

module.exports = mongoose.model('User', userSchema);