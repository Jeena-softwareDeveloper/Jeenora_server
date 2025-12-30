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
  role: {
    type: String,
    enum: ['JOB_SEEKER', 'job_seeker', 'hire', 'hireUser', 'admin'],
    default: 'JOB_SEEKER'
  },
  agreeTerms: {
    type: Boolean,
    required: [true, 'You must agree to the terms']
  },
  userType: {
    type: String,
    enum: ['FREE', 'CREDIT', 'SUBSCRIPTION'],
    default: 'FREE'
  },
  creditBalance: {
    type: Number,
    default: 0
  },
  headline: {
    type: String,
    default: ""
  },
  totalExperience: {
    type: Number,
    default: 0
  },
  currentRole: {
    type: String,
    default: ""
  },
  preferredRole: {
    type: String,
    default: ""
  },
  skills: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill'
  }],
  // We already have 'location' which is stored as String. We can add an alias or just use it. 
  // Requirement asks for 'currentLocation'. Let's add it explicitly if needed, or stick to 'location'.
  // Given we use 'location' in profile, let's keep 'location' as the primary but add 'currentLocation' alias or field.
  // Actually, let's just make sure 'location' is used as 'currentLocation'.
  location: {
    type: String, // City / Country
    default: ""
  },
  education: {
    type: String,
    default: null
  },
  latitude: {
    type: Number,
    default: null
  },
  longitude: {
    type: Number,
    default: null
  },
  expectedSalary: {
    type: Number,
    default: null
  },
  salary: { // Keeping legacy field for backward compat, but expectedSalary is the new one
    type: Number,
    default: null
  },
  noticePeriod: {
    type: String, // Immediate / 15 days / 30 days
    default: null
  },
  // Legacy noticeperiod (number) - keeping for compat
  noticeperiod: {
    type: Number,
    default: null
  },
  experience: { // Legacy description
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
  savedJobs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  }],


  // 🔹 NEW: profile image fields
  profileImageUrl: {
    type: String,
    default: null
  },

  profileImagePublicId: {   // for deleting from Cloudinary
    type: String,
    default: null
  },

  resumeEditorEnabled: {
    type: Boolean,
    default: false
  },

  subscription: {
    plan: { type: String, default: null }, // e.g. 'Basic', 'Premium'
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
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
hireUserSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  if (this.agreeTerms === undefined) {
    this.agreeTerms = true;
  }
  next();
});

module.exports = mongoose.model('HireUser', hireUserSchema);
