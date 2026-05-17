const { Schema, model } = require("mongoose");
const partnerWalletSchema = new Schema({
    partnerId: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    month: {
        type: Number,
        required: true
    },
    year: {
        type: Number,
        required: true
    }
}, { timestamps: true })
module.exports = model('partnerWallets', partnerWalletSchema)
