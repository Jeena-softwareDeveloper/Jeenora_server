const mongoose = require('mongoose')


const successStorySchema = new mongoose.Schema({
    heading: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, required: true },
    name: { type: String, required: true },
    area: { type: String, required: true },
    experience: { type: String, required: true },
    image: { type: String, required: true },
     isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true })


module.exports = mongoose.model('AwarenessSuccessStory', successStorySchema)
