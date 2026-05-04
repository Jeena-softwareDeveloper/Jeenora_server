const mongoose = require('mongoose');
require('dotenv').config();
const WearCategory = require('../models/wear/wearCategoryModel');

async function testStatus() {
    try {
        await mongoose.connect(process.env.DB_URL);
        const shirts = await WearCategory.findOne({name: 'Shirts'}).lean(); 
        
        console.log("Status:", `"${shirts.status}"`);
        console.log("Status length:", shirts.status.length);
        console.log("Char codes:", [...shirts.status].map(c => c.charCodeAt(0)));

        const findActive = await WearCategory.find({status: 'active'}).countDocuments();
        const findActive2 = await WearCategory.find({status: 'Active'}).countDocuments();
        
        console.log("find('active'):", findActive);
        console.log("find('Active'):", findActive2);
        
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}

testStatus();
