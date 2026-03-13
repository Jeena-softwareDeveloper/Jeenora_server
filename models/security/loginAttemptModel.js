const mongoose = require('mongoose');

/**
 * Login Attempt Model
 * Tracks failed login attempts per email for account lockout.
 * Auto-expires after 15 minutes via TTL index.
 */
const loginAttemptSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        index: true
    },
    ip: {
        type: String,
        default: null
    },
    attempts: {
        type: Number,
        default: 1
    },
    lockedUntil: {
        type: Date,
        default: null
    },
    lastAttemptAt: {
        type: Date,
        default: Date.now
    },
    // Auto-delete after 15 mins of no activity
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 15 * 60 * 1000)
    }
});

// Auto-delete stale records (TTL index)
loginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('LoginAttempt', loginAttemptSchema);
