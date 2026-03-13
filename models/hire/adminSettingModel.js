const mongoose = require('mongoose');

const adminSettingsSchema = new mongoose.Schema({
  siteName: {
    type: String,
    default: 'Job Portal'
  },
  siteDescription: {
    type: String,
    default: 'Find your dream job'
  },
  contactEmail: {
    type: String,
    default: 'admin@jobportal.com'
  },
  supportEmail: {
    type: String,
    default: 'support@jobportal.com'
  },
  maxLoginAttempts: {
    type: Number,
    default: 5
  },
  sessionTimeout: {
    type: Number, 
    default: 30
  },
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  allowedFileTypes: [{
    type: String,
    default: ['pdf', 'doc', 'docx']
  }],
  maxFileSize: {
    type: Number, 
    default: 5
  }
}, {
  timestamps: true
});

adminSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('AdminSettings', adminSettingsSchema);