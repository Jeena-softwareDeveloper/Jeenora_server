const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HireUser',
        required: true
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'JobPost',
        required: true
    },
    employerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HireUser',
        required: true
    },
    resumeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Resume',
        required: false
    },
    resumeUrl: String,
    coverLetter: String,

    // Additional Q&A
    answers: {
        noticePeriod: Number,
        expectedSalary: Number
    },

    creditsUsed: {
        type: Number,
        required: true
    },

    // Timeline & Status History
    currentStatus: {
        type: String,
        enum: ['applied', 'viewed', 'shortlisted', 'interview_scheduled', 'interview_completed', 'offer_extended', 'offer_accepted', 'offer_rejected', 'rejected', 'withdrawn'],
        default: 'applied'
    },
    statusHistory: [
        {
            status: String,
            date: { type: Date, default: Date.now },
            triggeredBy: String, // 'user', 'recruiter', 'system'
            notes: String,
            metadata: mongoose.Schema.Types.Mixed
        }
    ],

    // Interview Details (Array)
    interviews: [
        {
            // interviewId: String, // internal generation or just subdoc _id
            type: { type: String, enum: ['phone', 'video', 'onsite', 'technical', 'hr'] },
            round: Number,
            scheduledDate: Date,
            duration: Number, // minutes
            interviewer: String,
            interviewerRole: String,
            meetingLink: String,
            status: { type: String, enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'], default: 'scheduled' },
            preparationNotes: String,
            outcome: { type: String, enum: ['pending', 'passed', 'failed'], default: 'pending' },
            feedback: String
        }
    ],

    // Offer Details
    offer: {
        extendedDate: Date,
        deadline: Date,
        salary: {
            base: Number,
            bonus: Number,
            stocks: Number,
            currency: { type: String, default: 'USD' }
        },
        benefits: [String],
        status: { type: String, enum: ['pending', 'accepted', 'rejected', 'negotiating'], default: 'pending' }
    },

    // Rejection Details
    rejection: {
        date: Date,
        reason: String,
        feedback: String,
        reconsiderationPossible: { type: Boolean, default: false }
    },

    // Communication Log
    communications: [
        {
            type: { type: String, enum: ['email', 'message', 'whatsapp'] },
            direction: { type: String, enum: ['incoming', 'outgoing'] },
            subject: String,
            content: String,
            sentAt: { type: Date, default: Date.now },
            status: String // 'delivered', 'read'
        }
    ],

    // User Private Notes
    userNotes: [
        {
            note: String,
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now }
        }
    ],

    // Analytics
    analytics: {
        timeToFirstResponse: String,
        totalTimeInProcess: String,
        recruiterEngagement: {
            views: { type: Number, default: 0 },
            saves: { type: Number, default: 0 }
        }
    },

    chatEnabled: { type: Boolean, default: false },
    archived: { type: Boolean, default: false }
}, { timestamps: true });

// Ensure a user can only apply once to a job
applicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });

module.exports = mongoose.models.Application || mongoose.model('Application', applicationSchema);
