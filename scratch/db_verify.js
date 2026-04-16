const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

async function checkDB() {
    try {
        await mongoose.connect(process.env.DB_URL);
        const WearCategory = require('../models/wear/wearCategoryModel');
        const WearProduct = require('../models/wear/wearProductModel');
        const LegacyProduct = require('../models/wear/productModel');

        console.log('\n--- 1. MAIN CATEGORIES (Level 0) ---');
        const mains = await WearCategory.find({ level: 0 }).sort({ priority: 1 });
        mains.forEach(m => console.log(` + ${m.name} (Slug: ${m.slug}, Priority: ${m.priority})`));

        console.log('\n--- 2. SUB CATEGORIES FOR MEN TOPWEAR ---');
        const men = await WearCategory.findOne({ name: 'Men Topwear' });
        if (men) {
            const subs = await WearCategory.find({ parentId: men._id }).sort({ priority: 1 });
            subs.forEach(s => console.log(`   - ${s.name} (Slug: ${s.slug})`));
        }

        console.log('\n--- 3. PRODUCTS IN CASUAL SHIRTS ---');
        const casualProducts = await WearProduct.find({ subCategory: 'Casual Shirts' }).limit(3);
        casualProducts.forEach(p => console.log(`   * ${p.productName} (Cat: ${p.category}, Sub: ${p.subCategory})`));

        console.log('\n--- 4. PRODUCTS IN GOLD RINGS ---');
        const goldRings = await WearProduct.find({ subCategory: 'Gold Rings' }).limit(3);
        goldRings.forEach(p => console.log(`   * ${p.productName} (Cat: ${p.category}, Sub: ${p.subCategory})`));

        console.log('\n--- 5. LEGACY PRODUCTS SAMPLES ---');
        const legacy = await LegacyProduct.find({}).limit(5);
        legacy.forEach(p => console.log(`   ~ ${p.name} (Category: ${p.category})`));

        console.log('\n--- DB CHECK COMPLETE ---');
        process.exit(0);
    } catch (error) {
        console.error('Error checking DB:', error);
        process.exit(1);
    }
}

checkDB();
