const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const WearProduct = require('../models/wear/wearProductModel');

async function checkGrouping() {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('Connected to DB');

        const products = await WearProduct.find({ category: 'Mens' });
        console.log(`Total products under Mens: ${products.length}`);

        const catalogIds = products.map(p => p.catalogId || p._id.toString());
        const uniqueCatalogs = [...new Set(catalogIds)];
        
        console.log(`Unique Catalogs count: ${uniqueCatalogs.length}`);
        
        // Count how many products per catalog
        const counts = {};
        catalogIds.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
        console.log('Catalog counts:', counts);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

checkGrouping();
