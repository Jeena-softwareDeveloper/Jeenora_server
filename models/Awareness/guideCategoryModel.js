const mongoose = require('mongoose')

const guideCategorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true }
}, { timestamps: true })

module.exports  = mongoose.model('AwarenessGuideCategory', guideCategorySchema)



