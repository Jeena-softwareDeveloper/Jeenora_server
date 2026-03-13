const mongoose = require('mongoose');

const resumeEditRequestSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HireUser',
        required: [true, 'User ID is required']
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        // Optional: if editing for a specific job application
        default: null
    },
    currentResumeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Resume',
        required: [true, 'Current resume is required']
    },
    editorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ResumeEditor',
        required: [true, 'Editor ID is required']
    },
    targetRole: {
        type: String,
        required: [true, 'Target role is required']
    },
    requirements: {
        type: String,
        default: ''
    },
    creditsUsed: {
        type: Number,
        required: true,
        min: 1
    },
    paymentStatus: {
        type: String,
        enum: ['PENDING', 'PAID'],
        default: 'PENDING'
    },
    editorStatus: {
        type: String,
        enum: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'],
        default: 'ASSIGNED'
    },
    editedResumeUrl: {
        type: String,
        default: null
    },
    completedAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('ResumeEditRequest', resumeEditRequestSchema);
