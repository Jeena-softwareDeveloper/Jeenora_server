const mongoose = require('mongoose');

const campaignResultSchema = new mongoose.Schema({
  recipient: String,
  status: { type: String, enum: ['sent', 'failed', 'delivered', 'read', 'opened', 'clicked'] },
  error: String,
  sentAt: Date,
  messageId: String,
  deliveryDetails: mongoose.Schema.Types.Mixed,
  attempts: { type: Number, default: 1 }
});

const recurrenceConfigSchema = new mongoose.Schema({
  // New logic
  startDate: { type: String },
  startTime: { type: String, default: '09:00' },
  timezone: { type: String, default: 'Asia/Kolkata' },
  dailyMode: { type: String, enum: ['single', 'multiple'], default: 'single' },
  perDayCount: { type: Number, default: 1 },
  intervalMinutes: { type: Number, default: 0 },
  scheduleDays: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' },
  repeatCount: { type: Number, default: 1 },

  // Old logic (optional)
  interval: { type: Number, default: 1 },
  frequency: { type: String, enum: ['minutes', 'hours', 'days', 'weeks', 'months'], default: 'days' },
  times: { type: Number, default: 1 },
  daysOfWeek: [Number],
  endDate: Date
});



const campaignSchema = new mongoose.Schema({
  title: { type: String, required: true },
  mode: { type: String, enum: ['email', 'whatsapp'], required: true },
  subject: String,
  message: { type: String, required: true },
  category: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubscriberCategory' }],
  contacts: [{
    name: String,
    email: String,
    phone: String,
    countryCode: String
  }],
  emails: [String],
  phones: [String],
  status: { 
    type: String, 
    enum: ['draft', 'pending', 'scheduled', 'sending', 'sent', 'failed', 'paused','completed'], 
    default: 'draft' 
  },
  totalRecipients: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  openedCount: { type: Number, default: 0 },
  clickedCount: { type: Number, default: 0 },
  deliveredCount: { type: Number, default: 0 },
  readCount: { type: Number, default: 0 },
  
  // Scheduling
  scheduleType: { type: String, enum: ['immediate', 'scheduled', 'recurring'], default: 'immediate' },
  scheduledDate: Date,
  scheduledTime: { type: String, default: '09:00' },
  recurringPattern: { type: String, enum: ['daily', 'weekly', 'monthly', 'custom'] },
  repeatCount: { type: Number, default: 1 },
  currentRepeat: { type: Number, default: 0 },
  recurrenceConfig: recurrenceConfigSchema,
  
  // Media & Templates
  mediaUrl: String,
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate' },
  whatsappTemplate: String,
  
  // Tracking
  trackingEnabled: { type: Boolean, default: true },
  trackOpens: { type: Boolean, default: true },
  trackClicks: { type: Boolean, default: true },
  utmParams: {
    source: String,
    medium: String,
    campaign: String,
    content: String
  },
  
  // Sending options
  sendOptions: {
    delayBetweenMessages: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 1 },
    retryDelay: { type: Number, default: 300000 },
    batchSize: { type: Number, default: 10 }
  },
  
  results: [campaignResultSchema],
  isActive: { type: Boolean, default: true },
  startedAt: Date,
  completedAt: Date,
  lastSentAt: Date,
  error: String,
  
  // Analytics
  analytics: {
    deliveryRate: Number,
    openRate: Number,
    clickRate: Number,
    bounceRate: Number,
    engagementScore: Number
  }
}, {
  timestamps: true
});

// Indexes for better performance
campaignSchema.index({ status: 1 });
campaignSchema.index({ scheduleType: 1, scheduledDate: 1 });
campaignSchema.index({ mode: 1, createdAt: -1 });
campaignSchema.index({ 'analytics.deliveryRate': -1 });

module.exports = mongoose.model('Campaign', campaignSchema);