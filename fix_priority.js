const mongoose = require('mongoose');
require('dotenv').config();
const wearCategoryModel = require('./models/wear/wearCategoryModel');

async function fixPriority() {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('Connected to DB');

        const categories = await wearCategoryModel.find({});
        console.log(`Found ${categories.length} categories`);

        for (const cat of categories) {
            const currentPriority = cat.priority;
            const newPriority = parseInt(currentPriority) || 0;
            
            await wearCategoryModel.findByIdAndUpdate(cat._id, { priority: newPriority });
            console.log(`Updated ${cat.name}: ${currentPriority} -> ${newPriority}`);
        }

        console.log('✅ Done fixing priorities');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

fixPriority();
