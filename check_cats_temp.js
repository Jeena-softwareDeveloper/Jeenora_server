const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Users/jeena/Downloads/Jeenora_Projcts/Jeenora_server/.env' });

const wearCategorySchema = new mongoose.Schema({
    name: String,
    slug: String,
    image: String,
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'wearCategories',
        default: null
    },
    level: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

const WearCategory = mongoose.model('wearCategories', wearCategorySchema);

async function checkCategories() {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('Connected to DB');

        const allCategories = await WearCategory.find({}).lean();
        console.log(`Total Categories: ${allCategories.length}`);

        allCategories.forEach(c => {
            console.log(`- ID: ${c._id}, Name: ${c.name}, ParentId: ${c.parentId || 'None'}`);
        });

        const children = allCategories.filter(c => c.parentId);
        console.log(`\nChild Analysis:`);
        children.forEach(c => {
            const parent = allCategories.find(p => p._id.toString() === c.parentId.toString());
            console.log(`Child: ${c.name} (${c._id}) -> Parent: ${parent ? parent.name : 'MISSING (' + c.parentId + ')'}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkCategories();
