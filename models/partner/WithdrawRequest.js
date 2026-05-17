const {Schema, model} = require("mongoose");
const withdrawSchema = new Schema({
    partnerId: {
        type: String,
        required : true
    },
    amount: {
        type: Number,
        required : true
    },
    status: {
        type: String,
        default : 'pending'
    } 
},{ timestamps: true })
module.exports = model('WithdrawRequest',withdrawSchema)