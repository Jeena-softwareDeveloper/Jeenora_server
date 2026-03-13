const mongoose = require('mongoose');

const wearCartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WearBuyer',
        required: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WearProduct',
        required: true
    },
    quantity: {
        type: Number,
        default: 1,
        min: 1
    },
    size: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('WearCart', wearCartSchema);
