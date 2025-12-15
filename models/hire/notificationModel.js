const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'HireUser', 
    required: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['job', 'interview', 'payment', 'status', 'system'], 
    default: 'system' 
  },
  category: {
    type: String,
    enum: ['Job', 'System', 'Alert', 'Interview', 'Payment'],
    default: 'System'
  },
  link: { 
    type: String, 
    default: null 
  },
  isRead: { 
    type: Boolean, 
    default: false 
  },
  channel: [{ 
    type: String, 
    enum: ['dashboard', 'email', 'whatsapp'] 
  }],
  meta: { 
    type: Object, 
    default: {} 
  },
  scheduledAt: {
    type: Date,
    default: null
  },
  sent: {
    email: { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false },
    dashboard: { type: Boolean, default: true }
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  expiresAt: {
    type: Date,
    default: function() {
      const date = new Date();
      date.setDate(date.getDate() + 30); // Expire after 30 days
      return date;
    }
  }
});

// Index for better performance
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', notificationSchema);