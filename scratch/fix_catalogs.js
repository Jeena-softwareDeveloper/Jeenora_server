const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const WearCategory = require('../models/wear/wearCategoryModel');
const WearProduct = require('../models/wear/wearProductModel');

async function fixData() {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('Connected to DB');

        const mensParentId = '699c81910c237322c77c0afd';
        const subCats = await WearCategory.find({ parentId: mensParentId });
        const subCatNames = subCats.map(s => s.name);

        const products = await WearProduct.find({ category: 'Mens' });
        
        // Group by catalogId
        const groups = {};
        products.forEach(p => {
            const key = p.catalogId || p._id.toString();
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });

        console.log(`Found ${Object.keys(groups).length} catalogs.`);

        const catalogKeys = Object.keys(groups);
        for (let i = 0; i < catalogKeys.length; i++) {
            const key = catalogKeys[i];
            const groupProducts = groups[key];
            const targetSubCat = subCatNames[i % subCatNames.length]; // Pick one subcat for the WHOLE catalog

            for (const p of groupProducts) {
                await WearProduct.findByIdAndUpdate(p._id, {
                    subCategory: targetSubCat
                });
            }
            console.log(`Catalog ${key} (with ${groupProducts.length} products) moved to "${targetSubCat}"`);
        }

        console.log('Fix complete!');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

fixData();
