const { Schema, model } = require("mongoose");

const wearAuditLogSchema = new Schema({
    adminId: {
        type: Schema.Types.ObjectId,
        ref: 'admin',
        required: true
    },
    action: {
        type: String, // e.g., 'ORDER_STATUS_UPDATE', 'VENDOR_BLOCK', 'PRODUCT_STATUS_CHANGE'
        required: true
    },
    targetId: {
        type: Schema.Types.ObjectId,
        required: true
    },
    targetModel: {
        type: String, // e.g., 'customerOrders', 'suppliers', 'WearProduct'
        required: true
    },
    changes: {
        oldValue: Schema.Types.Mixed,
        newValue: Schema.Types.Mixed
    },
    ip: String,
    userAgent: String,
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = model('WearAuditLog', wearAuditLogSchema);
