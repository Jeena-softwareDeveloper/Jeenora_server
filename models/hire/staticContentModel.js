const mongoose = require('mongoose');

const staticContentSchema = new mongoose.Schema({
    page: {
        type: String,
        required: true,
        unique: true // 'home', 'how-it-works', 'pricing', 'jobs-preview', 'about', 'faq'
    },
    content: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

staticContentSchema.statics.getContent = async function (page) {
    let item = await this.findOne({ page });
    if (!item) {
        // Return empty object or default if not found
        item = { page, content: {} };
    }
    return item;
};

module.exports = mongoose.model('StaticContent', staticContentSchema);
