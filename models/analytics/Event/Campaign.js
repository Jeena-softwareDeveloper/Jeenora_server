const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  // Core identifiers
  campaign_id: { type: String, required: true, index: true },
  session_id: { type: String, required: true, index: true },
  user_id: { type: String, required: true, index: true },
  
  // Campaign data
  campaign_name: { type: String, required: true, index: true },
  campaign_type: { 
    type: String, 
    enum: ['awareness', 'consideration', 'conversion', 'retention'],
    index: true 
  },
  
  // UTM parameters
  utm_source: { type: String, index: true },
  utm_medium: { type: String, index: true },
  utm_campaign: { type: String, index: true },
  utm_content: { type: String },
  utm_term: { type: String },
  
  // Engagement metrics
  timestamp: { type: Date, required: true, index: true },
  ad_clicks: Number,
  ad_impressions: Number,
  cost_per_click: Number,
  cost_per_impression: Number,
  
  // Conversion data
  conversions: Number,
  conversion_value: Number,
  conversion_rate: Number,
  
  // Content engagement
  content_views: Number,
  time_spent: Number,
  social_shares: Number,
  
  // 🔗 EXTERNAL INTEGRATIONS
  social_media_platform: String,
  marketing_automation_trigger: String,
  crm_sync_status: String,
  
  custom_attributes: Map
}, {
  timestamps: true,
  collection: 'awareness_campaigns'
});

module.exports = mongoose.model('AwarenessCampaign', campaignSchema);