const { Schema, model } = require("mongoose");

const adminSettingsSchema = new Schema({
    settingKey: {
        type: String,
        required: true,
        unique: true
    },
    settingValue: {
        type: Schema.Types.Mixed,
        required: true
    },
    description: {
        type: String,
        default: ''
    }
}, { timestamps: true });

module.exports = model('adminSettings', adminSettingsSchema);
