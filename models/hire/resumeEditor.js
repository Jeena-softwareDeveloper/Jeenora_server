const mongoose = require("mongoose");

const resumeEditorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  specialization: { type: String, required: true },
  tagline: { type: String },
  bio: { type: String },
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  completedJobs: { type: Number, default: 0 },
  successRate: { type: Number, default: 0 },
  experience: { type: String },
  languages: [{ type: String }],
  expertise: [{ type: String }],
  price: { type: Number, required: true },
  originalPrice: { type: Number, required: true },
  deliveryTime: { type: String },
  responseTime: { type: String },
  avgDelivery: { type: String },
  isOnline: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  isPopular: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  discount: { type: Number },
  viewCount: { type: Number, default: 0 },
  likeCount: { type: Number, default: 0 },
  features: [{ type: String }],
  education: [
    {
      degree: { type: String },
      university: { type: String },
      year: { type: String },
    },
  ],
  certifications: [{ type: String }],
  awards: [{ type: String }],
  portfolio: [
    {
      beforeScore: { type: Number },
      afterScore: { type: Number },
      industry: { type: String },
      result: { type: String },
    },
  ],
  availability: {
    status: { type: String, default: "available" },
    nextAvailable: { type: Date },
    currentWorkload: { type: Number },
  },
  communication: {
    responseRate: { type: Number, default: 0 },
    responseTime: { type: String },
    preferredMethods: [{ type: String }],
  },
});

const ResumeEditor = mongoose.model("ResumeEditor", resumeEditorSchema);

module.exports = ResumeEditor;