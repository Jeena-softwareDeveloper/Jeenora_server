const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  type: { type: String, enum: ['email', 'whatsapp'], required: true },
  event: { type: String, enum: ['sent', 'delivered', 'opened', 'clicked', 'read', 'failed', 'bounced'] },
  recipient: String,
  messageId: String,
  timestamp: { type: Date, default: Date.now },
  details: mongoose.Schema.Types.Mixed,
  userAgent: String,
  ipAddress: String,
  location: {
    country: String,
    city: String,
    region: String
  },
  device: {
    type: String,
    os: String,
    browser: String
  }
}, {
  timestamps: true
});

// Indexes for analytics queries
analyticsSchema.index({ campaignId: 1, event: 1 });
analyticsSchema.index({ timestamp: 1 });
analyticsSchema.index({ recipient: 1 });

module.exports = mongoose.model('Analytics', analyticsSchema);