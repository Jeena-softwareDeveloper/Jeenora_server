const mongoose = require('mongoose');

const wearSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WearBuyer',
        required: true
    },
    refreshToken: {
        type: String,
        required: true,
        unique: true
    },
    ipAddress: {
        type: String
    },
    deviceId: {
        type: String,
        required: true
    },
    deviceName: {
        type: String
    },
    expiresAt: {
        type: Date,
        required: true
    },
    isRevoked: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Auto-delete expired sessions
wearSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
wearSessionSchema.index({ userId: 1 });


module.exports = mongoose.model('WearSession', wearSessionSchema);
