const mongoose = require('mongoose')


const videoSchema = new mongoose.Schema({
    heading: { type: String, required: true },
    secondaryHeading: { type: String },
    video: { type: String, required: true },
    views: { type: Number, default: 0 },
    author: { type: String, required: true },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true })

module.exports = mongoose.model('AwarenessVideo', videoSchema)