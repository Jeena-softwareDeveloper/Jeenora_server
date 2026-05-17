const { Schema, model } = require("mongoose");

const partnerCustomerSchema = new Schema({
    myId: {
        type: String,
        required: true
    },
    myFriends: {
        type: Array,
        default: []
    }
}, { timestamps: true })

module.exports = model('partner_customers', partnerCustomerSchema)
