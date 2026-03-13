const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    senderModel: {
        type: String,
        required: true,
        enum: ['HireUser', 'admins']
    },
    message: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const chatSupportTicketSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HireUser',
        required: true
    },
    // Optional: if assignment to specific admin is needed
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admins'
    },
    subject: {
        type: String,
        default: 'Support Request'
    },
    status: {
        type: String,
        default: 'open',
        enum: ['open', 'closed', 'pending', 'on-hold']
    },
    priority: {
        type: String,
        default: 'medium',
        enum: ['lowest', 'low', 'medium', 'high', 'highest', 'critical']
    },
    department: {
        type: String,
        default: 'General'
    },
    tags: [String],
    messages: [chatSchema],
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('ChatSupportTicket', chatSupportTicketSchema);
