const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  page_url: { 
    type: String, 
    required: true, 
    index: true 
  },
  page_title: String,
  
  total_views: { 
    type: Number, 
    default: 0 
  },
  unique_users: { 
    type: Number, 
    default: 0 
  },
  total_time_spent: { 
    type: Number, 
    default: 0 
  },
  avg_duration: { 
    type: Number, 
    default: 0 
  },
  
  referrer_sources: [{
    source: String,
    medium: String,
    campaign: String,
    visits: { 
      type: Number, 
      default: 0 
    },
    first_visit: Date,
    last_visit: Date
  }],
  
  first_viewed_at: { 
    type: Date, 
    default: Date.now 
  },
  last_viewed_at: Date,
  
  created_at: { 
    type: Date, 
    default: Date.now 
  },
  updated_at: { 
    type: Date, 
    default: Date.now 
  }
});

pageSchema.index({ page_url: 1 });
pageSchema.index({ 'referrer_sources.source': 1 });
pageSchema.index({ last_viewed_at: -1 });

pageSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Page', pageSchema);