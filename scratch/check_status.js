const mongoose = require('mongoose');
require('dotenv').config();
const WearCategory = require('../models/wear/wearCategoryModel');

async function checkStatus() {
    try {
        await mongoose.connect(process.env.DB_URL);
        const subs = await WearCategory.find({level:1}); 
        console.log("Sub Categories Statuses:");
        console.log(subs.map(s => ({name: s.name, status: s.status}))); 
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}

checkStatus();
