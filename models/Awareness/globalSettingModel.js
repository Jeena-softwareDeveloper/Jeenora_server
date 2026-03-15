const mongoose = require('mongoose');

const globalSettingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true }, // e.g. 'stats_baseline'
    value: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('GlobalSetting', globalSettingSchema);
