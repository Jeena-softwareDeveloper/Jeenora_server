const mongoose = require('mongoose')

const autoMatchLogSchema = new mongoose.Schema({
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'JobPost',
        required: true
    },
    applicantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HireUser',
        required: true
    },
    sentAt: {
        type: Date,
        default: Date.now
    },
    messageCost: {
        type: Number,
        default: 10
    },
    response: {
        type: String,
        enum: ['pending', 'interested', 'not_interested', 'no_response', 'opted_out'],
        default: 'pending'
    },
    responseAt: {
        type: Date
    },
    responseMessage: {
        type: String
    },
    messageProviderId: {
        type: String
    },
    messageStatus: {
        type: String,
        enum: ['sent', 'delivered', 'read', 'failed'],
        default: 'sent'
    },
    retryCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
})

autoMatchLogSchema.index({ jobId: 1, applicantId: 1 })
autoMatchLogSchema.index({ sentAt: -1 })
autoMatchLogSchema.index({ applicantId: 1, sentAt: -1 })

module.exports = mongoose.model('AutoMatchLog', autoMatchLogSchema)