const mongoose = require('mongoose');
require('dotenv').config();
const WearCategory = require('../models/wear/wearCategoryModel');

async function checkAlignment() {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log("Connected to MongoDB.");

        const mainCategories = await WearCategory.find({ level: 0 }).lean();
        console.log(`Found ${mainCategories.length} main categories.`);

        for (const mainCat of mainCategories) {
            console.log(`\n--- MAIN CATEGORY: ${mainCat.name} (Slug: ${mainCat.slug}) ---`);
            
            const subCategories = await WearCategory.find({ parentId: mainCat._id, level: 1 }).lean();
            if (subCategories.length === 0) {
                console.log(`  ❌ NO SUB-CATEGORIES FOUND!`);
            } else {
                console.log(`  ✅ ${subCategories.length} Sub-Categories found:`);
                for (const subCat of subCategories) {
                    const leafCategories = await WearCategory.find({ parentId: subCat._id, level: 2 }).lean();
                    console.log(`    -> ${subCat.name} (${leafCategories.length} leaf categories)`);
                    if (leafCategories.length > 0) {
                        console.log(`       Leaves: ${leafCategories.map(l => l.name).join(', ')}`);
                    } else {
                        console.log(`       ❌ NO LEAF CATEGORIES FOUND FOR ${subCat.name}!`);
                    }
                }
            }
        }

        console.log("\nChecking orphaned categories (sub or leaf categories without a valid parent)...");
        const allCategories = await WearCategory.find().lean();
        const mainIds = mainCategories.map(c => c._id.toString());
        let hasOrphans = false;

        for (const cat of allCategories) {
            if (cat.level > 0 && cat.parentId) {
                const parent = await WearCategory.findById(cat.parentId).lean();
                if (!parent) {
                    console.log(`  ⚠️ Orphaned Category: ${cat.name} (Level ${cat.level}). Parent ID ${cat.parentId} not found.`);
                    hasOrphans = true;
                }
            } else if (cat.level > 0 && !cat.parentId) {
                console.log(`  ⚠️ Orphaned Category: ${cat.name} (Level ${cat.level}). No parentId specified.`);
                hasOrphans = true;
            }
        }

        if (!hasOrphans) {
            console.log("  ✅ No orphaned categories found.");
        }

        mongoose.disconnect();
    } catch (error) {
        console.error("Error:", error);
        mongoose.disconnect();
    }
}

checkAlignment();
