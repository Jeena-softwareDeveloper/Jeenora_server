const mongoose = require('mongoose')
const AwarenessGuideCategory = require('./guideCategoryModel')

const guideSchema = new mongoose.Schema({
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'AwarenessGuideCategory', required: true },
    heading: { type: String, required: true },
    slug: { type: String, unique: true },
    level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], required: true },
    difficulty: { type: String }, // For frontend consistency
    secondHeading: { type: String },
    description: { type: String, required: true },
    content: { type: String }, // Detailed markdown/html content
    scientificAnalysis: { type: String }, 
    steps: [{ type: String }],  // Step-by-step guide
    maintenance: [{ type: String }],
    troubleshooting: [{ type: String }],
    benefits: [{ type: String }], // Benefits of the practice
    readTime: { type: String },
    image: { type: String },
    districts: [{ type: String }],
    crops: [{ type: String }],
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

guideSchema.index({ heading: 'text', description: 'text' });
guideSchema.index({ isActive: 1 });
guideSchema.index({ districts: 1 });
guideSchema.index({ crops: 1 });


module.exports= mongoose.model('AwarenessGuide', guideSchema)
