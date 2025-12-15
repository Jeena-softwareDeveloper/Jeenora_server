const mongoose = require('mongoose')

const jobPostSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    skill: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    experienceLevel: {
        type: String,
        enum: ['fresher', '1-3 years', '3-5 years', '5+ years'],
        required: true
    },
    salaryRange: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
    },
    interviewDateTime: {
        type: Date
    },
    interviewVenue: {
        type: String
    },
    autoMatchEnabled: {
        type: Boolean,
        default: false
    },
    maxCandidatesToPing: {
        type: Number,
        default: 10
    },
    status: {
        type: String,
        enum: ['active', 'closed', 'filled'],
        default: 'active'
    },
    employerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HireUser',
        required: true
    },
    createdBy: {
        type: String,
        enum: ['employer', 'admin'],
        default: 'employer'
    },
    creditsUsed: {
        type: Number,
        default: 0
    },
    totalMatches: {
        type: Number,
        default: 0
    },
    positiveResponses: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
})

jobPostSchema.index({ employerId: 1, createdAt: -1 })
jobPostSchema.index({ skill: 1, location: 1, status: 1 })

module.exports = mongoose.model('JobPost', jobPostSchema)