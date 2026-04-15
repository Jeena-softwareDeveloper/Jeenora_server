const mongoose = require('mongoose');
require('dotenv').config();

const test = async () => {
    await mongoose.connect(process.env.DB_URL);
    const WearProduct = mongoose.model('WearProduct', new mongoose.Schema({ productName: String, category: String, status: String }));
    const prods = await WearProduct.find({ status: 'active' });
    console.log('Total active products:', prods.length);
    prods.forEach(p => console.log(`- ${p.productName} | Category: ${p.category}`));
    process.exit();
};

test();
