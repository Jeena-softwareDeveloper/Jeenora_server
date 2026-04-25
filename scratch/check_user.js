const mongoose = require('mongoose');
const customerModel = require('../models/wear/customerModel');

const sellerModel = require('../models/wear/sellerModel');

async function checkUser() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/jeenora');
        console.log('Connected to DB');
        const email = 'jeena2284@gmail.com';
        const customer = await customerModel.findOne({ email });
        const seller = await sellerModel.findOne({ email });
        console.log('Customer:', customer);
        console.log('Seller:', seller);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUser();
