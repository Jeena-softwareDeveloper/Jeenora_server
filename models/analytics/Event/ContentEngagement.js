const mongoose = require('mongoose');

const contentEngagementSchema = new mongoose.Schema({
  // Core identifiers
  engagement_id: { type: String, required: true, unique: true, index: true },
  session_id: { type: String, required: true, index: true },
  user_id: { type: String, required: true, index: true },
  
  // 🏷️ CONTENT ENGAGEMENT METRICS
  content_type: { 
    type: String, 
    enum: ['blog', 'video', 'podcast', 'whitepaper', 'case_study', 'infographic'],
    required: true,
    index: true 
  },
  content_id: { type: String, required: true, index: true },
  content_title: { type: String, required: true },
  content_topic: { type: String, index: true },
  content_category: { type: String, index: true },
  author: { type: String, index: true },
  publish_date: Date,
  
  // Engagement metrics
  timestamp: { type: Date, required: true, index: true },
  time_on_content: Number,
  reading_time: Number,
  scroll_depth: Number,
  scroll_depth_per_section: Map,
  
  // User actions
  social_shares: [{
    platform: String,
    timestamp: Date
  }],
  comments_posted: Number,
  bookmarks_saves: { type: Boolean, default: false },
  print_actions: { type: Boolean, default: false },
  email_forwards: { type: Boolean, default: false },
  
  // Interactive features
  calculator_used: { type: Boolean, default: false },
  calculator_inputs: Map,
  calculator_results: Map,
  
  quiz_completions: { type: Boolean, default: false },
  quiz_score: Number,
  quiz_responses: Map,
  
  poll_responses: {
    poll_id: String,
    question: String,
    response: String
  },
  
  // 📝 FORM & LEAD GENERATION DATA
  form_submissions: {
    form_type: String,
    form_id: String,
    fields_completed: [String],
    completion_time: Number,
    lead_score: Number,
    contact_info: {
      email: String,
      phone: String,
      company: String,
      job_title: String
    }
  },
  
  // 🔔 NOTIFICATION & MESSAGING
  newsletter_signup: { type: Boolean, default: false },
  push_notification_permission: { type: Boolean, default: false },
  push_notification_clicks: [{
    notification_id: String,
    timestamp: Date
  }],
  
  custom_attributes: Map
}, {
  timestamps: true,
  collection: 'awareness_content_engagement'
});

module.exports = mongoose.model('AwarenessContentEngagement', contentEngagementSchema);