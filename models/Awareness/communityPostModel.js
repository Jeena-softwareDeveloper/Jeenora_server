const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    user: { type: String, required: true },
    text: { type: String, required: true },
    votes: { type: Number, default: 0 },
    isExpert: { type: Boolean, default: false }
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
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('AwarenessCommunityPost', communityPostSchema);
