const mongoose = require('mongoose');
const WearCategory = require('./models/wear/wearCategoryModel');
require('dotenv').config();

const categories = [
    { name: 'Women Ethnic', slug: 'women-ethnic', image: 'https://res.cloudinary.com/demo/image/upload/v1652345678/categories/women_ethnic.png', level: 0, priority: 1 },
    { name: 'Women Western', slug: 'women-western', image: 'https://res.cloudinary.com/demo/image/upload/v1652345678/categories/women_western.png', level: 0, priority: 2 },
    { name: 'Men', slug: 'men', image: 'https://res.cloudinary.com/demo/image/upload/v1652345678/categories/men.png', level: 0, priority: 3 },
    { name: 'Kids', slug: 'kids', image: 'https://res.cloudinary.com/demo/image/upload/v1652345678/categories/kids.png', level: 0, priority: 4 },
    { name: 'Home & Kitchen', slug: 'home-kitchen', image: 'https://res.cloudinary.com/demo/image/upload/v1652345678/categories/home.png', level: 0, priority: 5 },
    { name: 'Beauty & Health', slug: 'beauty-health', image: 'https://res.cloudinary.com/demo/image/upload/v1652345678/categories/beauty.png', level: 0, priority: 6 },
    { name: 'Jewellery & Accessories', slug: 'jewellery', image: 'https://res.cloudinary.com/demo/image/upload/v1652345678/categories/jewellery.png', level: 0, priority: 7 },
    { name: 'Bags & Footwear', slug: 'bags-footwear', image: 'https://res.cloudinary.com/demo/image/upload/v1652345678/categories/bags.png', level: 0, priority: 8 },
    { name: 'Electronics', slug: 'electronics', image: 'https://res.cloudinary.com/demo/image/upload/v1652345678/categories/electronics.png', level: 0, priority: 9 }
];

const seedCategories = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('Connected to DB');
        
        for (const cat of categories) {
            await WearCategory.findOneAndUpdate(
                { slug: cat.slug },
                cat,
                { upsert: true, new: true }
            );
        }
        
        console.log('Categories seeded successfully');
        process.exit();
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seedCategories();
