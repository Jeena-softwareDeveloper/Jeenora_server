const { Schema, model } = require('mongoose');

const addressSchema = new Schema({
    userId: {
        type: Schema.ObjectId,
        required: true,
        ref: 'customer'
    },
    name: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    pincode: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    city: {
        type: String,
        required: true
    },
    houseNo: {
        type: String,
        required: true
    },
    area: {
        type: String,
        required: true
    },
    landmark: {
        type: String
    },
    type: {
        type: String,
        enum: ['Home', 'Office'],
        default: 'Home'
    },
    isDefault: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = model('addresses', addressSchema);
