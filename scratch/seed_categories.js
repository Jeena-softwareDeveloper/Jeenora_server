const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

// Models
const WearCategory = require('../models/wear/wearCategoryModel');
const LegacyCategory = require('../models/wear/categoryModel');

const DB_URL = process.env.DB_URL || 'mongodb://127.0.0.1:27017/jeenora';

const fashionCategories = [
    {
        name: 'Women Ethnic',
        image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=500',
        slug: 'women-ethnic',
        priority: 100,
        sub: [
            { name: 'Sarees', image: 'https://images.unsplash.com/photo-16210030469983-98e550d6193c?q=80&w=300', slug: 'sarees', priority: 100 },
            { name: 'Kurtis & Suits', image: 'https://images.unsplash.com/photo-1629135061911-37d4468f7048?q=80&w=300', slug: 'kurtis-suits', priority: 90 },
            { name: 'Lehengas', image: 'https://images.unsplash.com/photo-1594235213600-9e58319f395b?q=80&w=300', slug: 'lehengas', priority: 80 },
            { name: 'Palazzos', image: 'https://images.unsplash.com/photo-1605763240000-7e93b172d754?q=80&w=300', slug: 'palazzos', priority: 70 }
        ]
    },
    {
        name: 'Women Western',
        image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&w=500',
        slug: 'women-western',
        priority: 90,
        sub: [
            { name: 'Dresses', image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?q=80&w=300', slug: 'dresses', priority: 100 },
            { name: 'Tops & Tees', image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?q=80&w=300', slug: 'tops-tees', priority: 90 },
            { name: 'Jeans', image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=300', slug: 'jeans', priority: 80 }
        ]
    },
    {
        name: 'Men Wear',
        image: 'https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?q=80&w=500',
        slug: 'men-wear',
        priority: 80,
        sub: [
            { name: 'T-Shirts', image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=300', slug: 'men-tshirts', priority: 100 },
            { name: 'Shirts', image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?q=80&w=300', slug: 'men-shirts', priority: 90 },
            { name: 'Trousers', image: 'https://images.unsplash.com/photo-1473966968600-fa804b86827b?q=80&w=300', slug: 'men-trousers', priority: 80 }
        ]
    },
    {
        name: 'Kids Wear',
        image: 'https://images.unsplash.com/photo-1514090458221-65bb69af63e4?q=80&w=500',
        slug: 'kids-wear',
        priority: 70,
        sub: [
            { name: 'Boys Fashion', image: 'https://images.unsplash.com/photo-1519238263530-99bbe197c904?q=80&w=300', slug: 'boys-fashion', priority: 100 },
            { name: 'Girls Fashion', image: 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?q=80&w=300', slug: 'girls-fashion', priority: 90 }
        ]
    }
];

const seedCategories = async () => {
    try {
        console.log('Connecting...');
        await mongoose.connect(DB_URL);
        
        console.log('Clearing old categories...');
        await WearCategory.deleteMany({});
        await LegacyCategory.deleteMany({});

        console.log('Seeding Main and Sub categories with Priority...');
        for (const cat of fashionCategories) {
            // 1. Create Main Category
            const mainCat = await WearCategory.create({
                name: cat.name,
                image: cat.image,
                slug: cat.slug,
                level: 0,
                priority: cat.priority
            });
            await LegacyCategory.create({
                name: cat.name,
                image: cat.image,
                slug: cat.slug,
                priority: cat.priority
            });

            console.log(`  Added Main: ${cat.name} (P:${cat.priority})`);

            // 2. Create Sub Categories
            for (const sub of cat.sub) {
                await WearCategory.create({
                    name: sub.name,
                    image: sub.image,
                    slug: sub.slug,
                    level: 1,
                    parentId: mainCat._id,
                    priority: sub.priority
                });
                await LegacyCategory.create({
                    name: sub.name,
                    image: sub.image,
                    slug: sub.slug,
                    priority: sub.priority
                });
                console.log(`    - Added Sub: ${sub.name} (P:${sub.priority})`);
            }
        }

        console.log('\nCATEGORIES SEEDED SUCCESSFULLY! 🚀');
        process.exit(0);
    } catch (error) {
        console.error('SEEDING FAILED:', error.message);
        process.exit(1);
    }
};

seedCategories();
