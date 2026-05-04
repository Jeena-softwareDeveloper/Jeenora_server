const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const WearCategory = require('../models/wear/wearCategoryModel');
const WearProduct = require('../models/wear/wearProductModel');

async function debugSearch() {
    try {
        await mongoose.connect(process.env.DB_URL || 'mongodb+srv://nutrio:nutrio@cluster0.zvpz4lh.mongodb.net/test');
        console.log('Connected to DB');

        const catId = '69ddfbbf6b85eb78ba7f2b15';
        
        // 1. Find the category
        const cat = await WearCategory.findById(catId);
        if (!cat) {
            console.log(`Category with ID ${catId} not found.`);
            
            // List some categories to see what we have
            const someCats = await WearCategory.find({}).limit(5);
            console.log('Sample categories in DB:', someCats.map(c => ({ id: c._id, name: c.name })));
            return;
        }

        console.log(`Found Category: ${cat.name} (ID: ${cat._id})`);

        // 2. Find products with this category name
        const products = await WearProduct.find({
            $or: [
                { category: { $regex: new RegExp(`^${cat.name}$`, 'i') } },
                { subCategory: { $regex: new RegExp(`^${cat.name}$`, 'i') } }
            ]
        });

        console.log(`Found ${products.length} products matching name "${cat.name}"`);
        if (products.length > 0) {
            console.log('Sample product names:', products.slice(0, 5).map(p => p.productName));
        }

        // 3. Find products with this ID string (just in case)
        const productsById = await WearProduct.find({
            $or: [
                { category: catId },
                { subCategory: catId }
            ]
        });
        console.log(`Found ${productsById.length} products matching ID string "${catId}"`);

        // 4. List all unique subCategories in products to see what's there
        const uniqueSubCats = await WearProduct.distinct('subCategory');
        console.log('Unique subCategories in products:', uniqueSubCats);

        const mensProducts = await WearProduct.find({
            $or: [
                { category: 'Mens' },
                { subCategory: 'Mens' }
            ]
        });
        console.log(`Found ${mensProducts.length} products matching "Mens"`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

debugSearch();
