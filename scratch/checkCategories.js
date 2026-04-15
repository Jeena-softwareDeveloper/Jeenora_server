const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const WearCategory = require('../models/wear/wearCategoryModel');

const checkCategories = async () => {
    try {
        console.log('Connecting to DB:', process.env.DB_URL);
        await mongoose.connect(process.env.DB_URL);
        console.log('✅ Connected.');

        const categories = await WearCategory.find({}).lean();
        
        if (categories.length === 0) {
            console.log('❌ No categories found in WearCategory collection.');
        } else {
            console.log(`✅ Found ${categories.length} categories:`);
            console.table(categories.map(c => ({
                ID: c._id.toString(),
                Name: c.name,
                Slug: c.slug,
                Level: c.level,
                Parent: c.parentId ? c.parentId.toString() : 'Root'
            })));
        }
        process.exit(0);
    } catch (error) {
        console.error('❌ Check Failed:', error);
        process.exit(1);
    }
};

checkCategories();
