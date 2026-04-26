const mongoose = require('mongoose');
require('dotenv').config();
const WearProduct = require('./models/wear/wearProductModel');

mongoose.connect(process.env.DB_URL).then(async () => {
    const products = await WearProduct.find({ sellerId: '69ec8fe5821b5bef49d9b0a6' }).lean();
    products.forEach(p => {
        console.log('--- Product ---');
        console.log('Name:', p.productName);
        console.log('_id:', p._id);
        console.log('catalogId:', p.catalogId);
        console.log('catalogId type:', typeof p.catalogId);
    });
    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
