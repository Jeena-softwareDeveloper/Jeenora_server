const mongoose = require('mongoose');

const accountsSchema = new mongoose.Schema({
  twitter: { type: String },
  facebook: { type: String },
  instagram: { type: String },
  phoneNumber: { type: String },
  email: { type: String },
  linkedin: { type: String },
  youtube: { type: String },
  whatsapp: { type: String },
  role: {
    type: String,
    enum: ['Admin', 'Staff', 'User', 'Customer'],
    required: true
  },
  isActive: { type: Boolean, default: true },
  name: { type: String },
  area: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('AwarenessAccounts', accountsSchema);
