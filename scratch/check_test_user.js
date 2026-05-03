const mongoose = require('mongoose');
const Customer = require('./models/wear/customerModel');
const WearBuyer = require('./models/wear/wearBuyerModel');
require('dotenv').config();

async function checkUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://jeenora:jeenora123@cluster0.zvpz4lh.mongodb.net/test');
        console.log('DB Connected');
        
        const email = 'jeena2284@gmail.com';
        let user = await WearBuyer.findOne({ email });
        if (!user) user = await Customer.findOne({ email });
        
        if (user) {
            console.log(`User found: ${user.name}, Phone: ${user.phone}`);
        } else {
            console.log('User NOT found with email:', email);
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUser();
