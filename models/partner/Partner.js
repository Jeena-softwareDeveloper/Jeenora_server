const { Schema, model } = require("mongoose");

const partnerSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    role: {
        type: String,
        default: 'admin'
    },
    status: {
        type: String,
        default: 'pending'
    },
    payment: {
        type: String,
        default: 'inactive'
    },
    method: {
        type: String,
        required: true
    },
    image: {
        type: String,
        default: ''
    },
    shopInfo: {
        type: Object,
        default: {}
    },
    permissions: {
        type: [String],
        default: []
    }
}, { timestamps: true })

partnerSchema.index({
    name: 'text',
    email: 'text',

}, {
    weights: {
        name: 5,
        email: 4,

    }
})

const Partner = model('Partner', partnerSchema);
model('partners', partnerSchema);
module.exports = Partner;
