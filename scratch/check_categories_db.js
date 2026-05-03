const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const wearCategoryModel = require('../models/wear/wearCategoryModel');

const checkCategories = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('✅ DB Connected');

        const rootCategories = await wearCategoryModel.find({ level: 0 }).select('name level parentId');
        console.log('--- ROOT CATEGORIES (LEVEL 0) ---');
        console.log(`Total Found: ${rootCategories.length}`);
        rootCategories.forEach(cat => {
            console.log(`- ${cat.name} (ID: ${cat._id})`);
        });

        const allCategoriesCount = await wearCategoryModel.countDocuments({});
        console.log(`\nTotal Categories in DB: ${allCategoriesCount}`);

        process.exit();
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

checkCategories();
