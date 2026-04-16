const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

// Models
const WearCategory = require('../models/wear/wearCategoryModel');
const LegacyCategory = require('../models/wear/categoryModel');

const DB_URL = process.env.DB_URL;

const mainCategories = [
    { name: 'Women Ethnic', slug: 'women-ethnic', priority: 100, img: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=500' },
    { name: 'Women Western', slug: 'women-western', priority: 95, img: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&w=500' },
    { name: 'Men Topwear', slug: 'men-topwear', priority: 90, img: 'https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?q=80&w=500' },
    { name: 'Men Bottomwear', slug: 'men-bottomwear', priority: 85, img: 'https://images.unsplash.com/photo-1473966968600-fa804b86827b?q=80&w=500' },
    { name: 'Kids Fashion', slug: 'kids-fashion', priority: 80, img: 'https://images.unsplash.com/photo-1514090458221-65bb69af63e4?q=80&w=500' },
    { name: 'Footwear', slug: 'footwear', priority: 75, img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=500' },
    { name: 'Beauty', slug: 'beauty-care', priority: 70, img: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=500' },
    { name: 'Accessories', slug: 'fashion-accessories', priority: 65, img: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?q=80&w=500' },
    { name: 'Home & Living', slug: 'home-living', priority: 60, img: 'https://images.unsplash.com/photo-1484101403633-562f891dc89a?q=80&w=500' },
    { name: 'Jewellery', slug: 'womens-jewellery', priority: 55, img: 'https://images.unsplash.com/photo-1515562141207-7a88fb0ce33e?q=80&w=500' }
];

const seedMainOnly = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(DB_URL);
        
        console.log('Purging current categories...');
        await WearCategory.deleteMany({});
        await LegacyCategory.deleteMany({});

        console.log('Seeding 10 Main Categories only...');
        for (const cat of mainCategories) {
            await WearCategory.create({
                name: cat.name,
                image: cat.img,
                slug: cat.slug,
                level: 0,
                priority: cat.priority
            });
            await LegacyCategory.create({
                name: cat.name,
                image: cat.img,
                slug: cat.slug,
                priority: cat.priority
            });
            console.log(`  Added: ${cat.name}`);
        }

        console.log('\nMAIN CATEGORIES SEEDED SUCCESSFULLY! 🚀');
        process.exit(0);
    } catch (error) {
        console.error('SEEDING FAILED:', error.message);
        process.exit(1);
    }
};

seedMainOnly();
