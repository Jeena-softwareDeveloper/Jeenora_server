const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    company: {
        name: { type: String, required: true },
        logo: { type: String, default: '' }, // Optional logo
        about: String,
        industry: String,
        size: String,
        website: String
    },
    description: {
        type: String,
        required: true
    },
    requirements: {
        mustHave: [String],
        goodToHave: [String],
        experience: {
            min: { type: Number, default: 0 },
            max: { type: Number, default: 0 }
        },
        education: [String]
    },
    location: {
        city: { type: String, required: true },
        state: String,
        country: { type: String, default: 'India' },
        isRemote: { type: Boolean, default: false },
        hybridDays: { type: Number, default: 0 } // 0 means not hybrid or fully onsite/remote depending on isRemote
    },
    jobType: {
        type: String,
        enum: ['full-time', 'part-time', 'contract', 'internship', 'freelance'],
        default: 'full-time'
    },
    salary: {
        min: Number,
        max: Number,
        currency: { type: String, default: 'INR' },
        isDisclosed: { type: Boolean, default: true },
        bonus: String
    },
    application: {
        creditsRequired: { type: Number, default: 1 },
        deadline: Date,
        maxApplications: { type: Number, default: 100 },
        process: [String] // e.g., ["Resume Screening", "Technical Round", "HR Round"]
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'paused', 'closed'],
        default: 'active'
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admins', // Corrected reference to match adminModel.js export
        // Based on other files, maybe 'seller' or just generic ID. The prompt says "postedBy: admin_id".
    },
    postedDate: {
        type: Date,
        default: Date.now
    },
    expiryDate: Date,
    stats: {
        totalViews: { type: Number, default: 0 },
        totalApplications: { type: Number, default: 0 },
        shortlisted: { type: Number, default: 0 }
    }
}, { timestamps: true });

// Text indices for searching
jobSchema.index({ title: 'text', 'company.name': 'text', 'location.city': 'text', 'requirements.mustHave': 'text' });

module.exports = mongoose.models.Job || mongoose.model('Job', jobSchema);
