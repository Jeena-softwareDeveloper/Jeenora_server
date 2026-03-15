const mongoose = require('mongoose');

const homeContentSchema = new mongoose.Schema({
    sectionKey: { type: String, required: true, unique: true }, // e.g. 'about', 'impact', 'branches'
    title: { type: String },
    subtitle: { type: String },
    description: { type: String },
    cards: [{
        title: { type: String },
        body: { type: String },
        points: [String],
        tags: [String],
        icon: { type: String },
        image: { type: String },
        link: { type: String },
        color: { type: String }
    }]
}, { timestamps: true });

module.exports = mongoose.model('HomeContent', homeContentSchema);
