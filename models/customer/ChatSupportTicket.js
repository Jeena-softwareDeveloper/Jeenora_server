const { Schema, model } = require('mongoose');

const chatSupportTicketSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'Customer'
    },
    subject: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        default: 'support'
    },
    status: {
        type: String,
        default: 'pending'
    }
}, { timestamps: true });

module.exports = model('ChatSupportTicket', chatSupportTicketSchema);
