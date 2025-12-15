// models/hire/hireUserModel.js
const mongoose = require('mongoose');

const hireUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please enter your name']
  },
  email: {
    type: String,
    required: [true, 'Please enter your email'],
    unique: true
  },
  phone: {
    type: String,
    required: [true, 'Please enter your phone number']
  },
  password: {
    type: String,
    required: [true, 'Please enter your password'],
    select: false
  },
  skills: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill'
  }],
  location: {
    type: String,
    default: ""
  },
  education: {
    type: String,
    required: [true, 'Please enter your education']
  },
  latitude: {
    type: Number,
    default: null
  },
  longitude: {
    type: Number,
    default: null
  },
  salary: {
    type: Number,
    default: null
  },
  noticeperiod: {
    type: Number,
    default: null
  },
  experience: {
    type: String,
    default: null
  },
  resumeUrl: {
    type: String,
    default: null
  },
  jobPreferences: {
    locations: [String],
    roles: [String],
    salaryMin: Number,
    jobTypes: [String] // remote, onsite, etc
  },


  // 🔹 NEW: profile image fields
  profileImageUrl: {
    type: String,
    default: null
  },
  profileImagePublicId: {   // for deleting from Cloudinary
    type: String,
    default: null
  },

  subscription: {
    plan: { type: String, default: 'Free' },
    status: { type: String, default: 'inactive' },
    startDate: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    paymentId: { type: String, default: null }
  },
  settings: {
    notifications: {
      emailNotifications: { type: Boolean, default: true },
      smsNotifications: { type: Boolean, default: false },
      jobAlerts: { type: Boolean, default: true },
      promotionalEmails: { type: Boolean, default: false }
    },
    language: {
      preferredLanguage: { type: String, default: 'en' },
      timezone: { type: String, default: 'UTC' },
      dateFormat: { type: String, default: 'MM/DD/YYYY' }
    },
    security: {
      twoFactorAuth: { type: Boolean, default: false },
      lastPasswordChange: { type: Date, default: Date.now },
      loginAlerts: { type: Boolean, default: true }
    },
    privacy: {
      profileVisibility: { type: String, enum: ['public', 'private', 'connections'], default: 'public' },
      showEmail: { type: Boolean, default: false },
      showPhone: { type: Boolean, default: false },
      searchEngineIndexing: { type: Boolean, default: true }
    },
    account: {
      deactivationDate: { type: Date, default: null },
      deletionDate: { type: Date, default: null },
      isActive: { type: Boolean, default: true }
    }
  },
  role: {
    type: String,
    default: 'hireUser'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('HireUser', hireUserSchema);
