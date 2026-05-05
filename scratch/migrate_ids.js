const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const wearProductModel = require('../models/wear/wearProductModel');
const wearCategoryModel = require('../models/wear/wearCategoryModel');

async function migrate() {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('Connected to DB');
        
        const products = await wearProductModel.find();
        console.log(`Found ${products.length} products to check.`);

        for (const product of products) {
            let updated = false;
            
            if (product.category && !product.categoryId) {
                const cat = await wearCategoryModel.findOne({ name: product.category });
                if (cat) {
                    product.categoryId = cat._id;
                    updated = true;
                }
            }

            if (product.subCategory && !product.subCategoryId) {
                const subCat = await wearCategoryModel.findOne({ name: product.subCategory });
                if (subCat) {
                    product.subCategoryId = subCat._id;
                    updated = true;
                }
            }

            if (updated) {
                await product.save();
                console.log(`Updated IDs for: ${product.productName}`);
            }
        }

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
