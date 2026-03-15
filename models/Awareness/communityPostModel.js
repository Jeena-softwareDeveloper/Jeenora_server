const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    user: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer' },
    text: { type: String, required: true },
    votes: { type: Number, default: 0 },
    likedBy: [{ type: String }],
    dislikedBy: [{ type: String }],
    isExpert: { type: Boolean, default: false },
    replies: [{
        user: String,
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer' },
        text: String,
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

const communityPostSchema = new mongoose.Schema({
    authorName: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer' },
    isVerified: { type: Boolean, default: false },
    title: { type: String, required: true },
    content: { type: String, required: true },
    crop: { type: String, default: 'General' },
    votes: { type: Number, default: 0 },
    likedBy: [{ type: String }],
    dislikedBy: [{ type: String }],
    comments: [commentSchema],
    image: { type: String, default: '' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('AwarenessCommunityPost', communityPostSchema);
