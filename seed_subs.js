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

const sampleSubs = [
    { name: 'Shirts', parentName: 'Mens', image: 'https://images.meesho.com/images/products/310328224/unvxz_512.webp' },
    { name: 'T-Shirts', parentName: 'Mens', image: 'https://images.meesho.com/images/products/347492160/z5m7k_512.webp' },
    { name: 'Jeans', parentName: 'Mens', image: 'https://images.meesho.com/images/products/310328224/unvxz_512.webp' },
    { name: 'Trousers', parentName: 'Mens', image: 'https://images.meesho.com/images/products/347492160/z5m7k_512.webp' },
    
    { name: 'Kurtas', parentName: 'Women', image: 'https://images.meesho.com/images/products/263544521/vaxzo_512.webp' },
    { name: 'Sarees', parentName: 'Women', image: 'https://images.meesho.com/images/products/263544521/vaxzo_512.webp' },
    { name: 'Dresses', parentName: 'Women', image: 'https://images.meesho.com/images/products/263544521/vaxzo_512.webp' },
    
    { name: 'Toys', parentName: 'Kids', image: 'https://images.meesho.com/images/products/347492160/z5m7k_512.webp' },
    { name: 'Baby Wear', parentName: 'Kids', image: 'https://images.meesho.com/images/products/347492160/z5m7k_512.webp' }
];

async function seedSubs() {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('Connected to DB');

        const parents = await WearCategory.find({ parentId: null });
        console.log(`Found ${parents.length} parent categories.`);

        for (const sub of sampleSubs) {
            const parent = parents.find(p => p.name.toLowerCase() === sub.parentName.toLowerCase());
            if (parent) {
                const exists = await WearCategory.findOne({ name: sub.name, parentId: parent._id });
                if (!exists) {
                    await WearCategory.create({
                        name: sub.name,
                        slug: sub.name.toLowerCase().replace(/ /g, '-'),
                        parentId: parent._id,
                        level: 1,
                        image: sub.image
                    });
                    console.log(`Created subcategory: ${sub.name} under ${sub.parentName}`);
                } else {
                    console.log(`Subcategory ${sub.name} already exists under ${sub.parentName}`);
                }
            } else {
                console.warn(`Parent ${sub.parentName} not found!`);
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

seedSubs();
