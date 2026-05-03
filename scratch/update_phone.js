const mongoose = require('mongoose');
require('dotenv').config();
const sellerModel = require('../models/wear/sellerModel');

async function update() {
    await mongoose.connect(process.env.DB_URL);
    const res = await sellerModel.updateOne({ name: 'jeena' }, { $set: { phoneNumber: '916374631692' } });
    console.log('Update result:', res);
    process.exit(0);
}
update();
