const mongoose = require('mongoose');

const navMenuSchema = new mongoose.Schema({
    platform: {
        type: String,
        required: true,
        enum: ['supplier', 'customer', 'admin']
    },
    sections: [{
        title: String,
        items: [{
            name: { type: String, required: true },
            icon: { type: String, required: true },
            color: String,
            path: { type: String, required: true },
            locked: { type: Boolean, default: false }
        }]
    }]
}, { timestamps: true });

module.exports = mongoose.model('NavMenu', navMenuSchema);
