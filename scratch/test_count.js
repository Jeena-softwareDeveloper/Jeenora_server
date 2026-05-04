const mongoose = require('mongoose');
require('dotenv').config();
const WearCategory = require('../models/wear/wearCategoryModel');

async function testCount() {
    try {
        await mongoose.connect(process.env.DB_URL);
        const mens = await WearCategory.findOne({name: 'Mens'}).lean(); 
        console.log("Mens ID:", mens._id);

        const withoutStatus = await WearCategory.find({ parentId: mens._id });
        console.log("Without status:", withoutStatus.length);

        const withStatus = await WearCategory.find({ parentId: mens._id, status: 'active' });
        console.log("With status:", withStatus.length);

        // Check exact parentId matching using toString
        const rawItems = await WearCategory.find();
        const matches = rawItems.filter(i => i.parentId && i.parentId.toString() === mens._id.toString());
        console.log("Raw matches:", matches.length);

        console.log("Matches details:", matches.map(m => ({name: m.name, status: m.status, parentId: m.parentId})));

        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}

testCount();
