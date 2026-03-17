const mongoose = require('mongoose')


const successStorySchema = new mongoose.Schema({
    heading: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, required: true },
    name: { type: String, required: true },
    area: { type: String, required: true },
    village: { type: String },
    district: { type: String },
    year: { type: String },
    crop: { type: String },
    experience: { type: String, required: true },
    image: { type: String, required: true }, // Main/After image
    before_image: { type: String },
    photo: { type: String }, // User profile photo
    yield_before: { type: String },
    yield_after: { type: String },
    income_before: { type: String },
    income_after: { type: String },
    likes: { type: String, default: '0' },
    techniques: [String],
    timeline: [{
        month: String,
        event: String
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true })


module.exports = mongoose.model('AwarenessSuccessStory', successStorySchema)
