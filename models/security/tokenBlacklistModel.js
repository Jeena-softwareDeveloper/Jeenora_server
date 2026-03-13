const mongoose = require('mongoose');

/**
 * Token Blacklist Model
 * Stores invalidated JWT tokens to ensure logged-out tokens cannot be reused.
 * TTL index auto-deletes expired tokens from the database.
 */
const tokenBlacklistSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    invalidatedAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true
    }
}, { timestamps: false });

// Auto-delete expired blacklisted tokens (MongoDB TTL index)
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('TokenBlacklist', tokenBlacklistSchema);
