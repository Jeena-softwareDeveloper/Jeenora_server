const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const WearCategory = require('../models/wear/wearCategoryModel');
const WearProduct = require('../models/wear/wearProductModel');

async function migrateProducts() {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('Connected to DB');

        const mensParentId = '699c81910c237322c77c0afd';
        
        // 1. Get all subcategories of Mens
        const subCats = await WearCategory.find({ parentId: mensParentId });
        console.log(`Mens has ${subCats.length} subcategories:`, subCats.map(s => s.name));

        if (subCats.length === 0) {
            console.log('No subcategories found for Mens. Migration aborted.');
            return;
        }

        // 2. Get all products under "Mens"
        const products = await WearProduct.find({ category: 'Mens' });
        console.log(`Found ${products.length} products under "Mens" category.`);

        // 3. Distribute them
        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            const subCat = subCats[i % subCats.length]; // Cycle through subcategories
            
            await WearProduct.findByIdAndUpdate(product._id, {
                subCategory: subCat.name
            });
            console.log(`Updated product "${product.productName}" to subCategory "${subCat.name}"`);
        }

        console.log('Migration complete!');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

migrateProducts();
