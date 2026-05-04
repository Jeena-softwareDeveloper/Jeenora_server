const mongoose = require('mongoose');
require('dotenv').config();
const WearCategory = require('../models/wear/wearCategoryModel');

async function checkIds() {
    try {
        await mongoose.connect(process.env.DB_URL);
        const mens = await WearCategory.findOne({name: 'Mens'}); 
        console.log("Mens ID:", mens ? mens._id.toString() : "Not found");

        const shirts = await WearCategory.findOne({name: 'Shirts'}); 
        console.log("Shirts Parent ID:", shirts ? shirts.parentId.toString() : "Not found");
        
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}

checkIds();
