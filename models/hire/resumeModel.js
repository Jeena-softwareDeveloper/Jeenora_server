const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HireUser',
        required: true
    },
    resumeTitle: {
        type: String,
        required: true
    },
    fileUrl: {
        type: String,
        required: true
    },
    fileType: {
        type: String,
        enum: ['PDF', 'DOCX'],
        required: true
    },
    publicId: { // For Cloudinary deletion
        type: String,
        default: null
    },
    isPrimary: {
        type: Boolean,
        default: false
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Resume', resumeSchema);
