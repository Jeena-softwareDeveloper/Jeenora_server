const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true
  },
  predicted_churn: {
    type: Number,
    min: 0,
    max: 1
  },
  predicted_session_duration: Number,
  predicted_lifetime_value: Number,
  predicted_next_purchase: Date,
  model_version: {
    type: String,
    required: true
  },
  prediction_timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  features: {
    total_sessions: Number,
    avg_session_duration: Number,
    days_since_last_visit: Number,
    total_purchases: Number,
    total_revenue: Number
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

predictionSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Prediction', predictionSchema);