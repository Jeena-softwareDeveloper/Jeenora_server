const mongoose = require('mongoose')
const AwarenessGuideCategory = require('./guideCategoryModel')

const guideSchema = new mongoose.Schema({
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'AwarenessGuideCategory', required: true },
    heading: { type: String, required: true },
    level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], required: true },
    secondHeading: { type: String },
    description: { type: String, required: true },
    image: { type: String },
     isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true })


module.exports= mongoose.model('AwarenessGuide', guideSchema)
