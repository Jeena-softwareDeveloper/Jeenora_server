const mongoose = require('mongoose');

const farmerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please enter your name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please enter your email'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Please enter your password'],
    select: false
  },
  district: {
    type: String,
    required: [true, 'Please select your district']
  },
  crops: {
    type: [String],
    default: []
  },
  role: {
    type: String,
    default: 'farmer'
  },
  points: {
    type: Number,
    default: 0
  },
  consults: {
    type: Number,
    default: 0
  },
  impactCore: {
    type: Number,
    default: 0
  },
  postsCount: {
    type: Number,
    default: 0
  },
  rank: {
    type: String,
    default: 'Beginner'
  },

  profileCompletion: {
    type: Number,
    default: 0
  },
  language: {
    type: String,
    default: 'English'
  },
  image: {
    type: String,
    default: ''
  },

  savedGuides: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AwarenessGuide'
  }],
  savedVideos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AwarenessVideo'
  }],
  streak: {
    count: { type: Number, default: 0 },
    lastLogin: { type: Date }
  }
}, { timestamps: true });

module.exports = mongoose.model('Farmer', farmerSchema);
