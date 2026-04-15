const mongoose = require('mongoose');
require('dotenv').config();

const WearCategory = require('./models/wear/wearCategoryModel');
const WearProduct = require('./models/wear/wearProductModel');

const MONGODB_URI = process.env.DB_URL;
const SELLER_ID = '6986cfd9c98bac524d5ce299'; // Existing approved supplier

const seedData = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const mainCategories = [
            { name: "Men's Wear", slug: 'mens-wear', image: 'https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?w=500&q=80', description: 'Premium collection for men', level: 0 },
            { name: "Women's Wear", slug: 'womens-wear', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&q=80', description: 'Elegant styles for women', level: 0 },
            { name: "Kids Wear", slug: 'kids-wear', image: 'https://images.unsplash.com/photo-1519706342417-4835682855cf?w=500&q=80', description: 'Comfortable clothing for kids', level: 0 },
            { name: "Accessories", slug: 'accessories', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80', description: 'Complete your look', level: 0 },
            { name: "Electronics", slug: 'electronics', image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=500&q=80', description: 'Latest gadgets', level: 0 },
            { name: "Home & Living", slug: 'home-living', image: 'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=500&q=80', description: 'Everything for your home', level: 0 }
        ];

        console.log('🌱 Seeding Main Categories...');
        const catMap = {};
        for (const cat of mainCategories) {
            let existing = await WearCategory.findOne({ slug: cat.slug });
            if (!existing) {
                existing = await WearCategory.create(cat);
                console.log(`   + Created Main: ${cat.name}`);
            } else {
                // Update to ensure level and image are correct
                existing.level = 0;
                existing.image = cat.image;
                await existing.save();
            }
            catMap[cat.name] = existing._id;
        }

        const subCategories = [
            { name: "T-Shirts", slug: 'mens-tshirts', parentId: catMap["Men's Wear"], level: 1, image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=200&q=80' },
            { name: "Jeans", slug: 'mens-jeans', parentId: catMap["Men's Wear"], level: 1, image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=200&q=80' },
            { name: "Sarees", slug: 'womens-sarees', parentId: catMap["Women's Wear"], level: 1, image: 'https://images.unsplash.com/photo-1583391733956-6c7827447992?w=200&q=80' },
            { name: "Kurtis", slug: 'womens-kurtis', parentId: catMap["Women's Wear"], level: 1, image: 'https://images.unsplash.com/photo-1628144410173-1f60045952d9?w=200&q=80' },
            { name: "Smartphones", slug: 'electronics-mobiles', parentId: catMap["Electronics"], level: 1, image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=200&q=80' },
            { name: "Laptops", slug: 'electronics-laptops', parentId: catMap["Electronics"], level: 1, image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=200&q=80' }
        ];

        console.log('🌱 Seeding Sub Categories...');
        for (const sub of subCategories) {
            await WearCategory.findOneAndUpdate(
                { slug: sub.slug },
                sub,
                { upsert: true, new: true }
            );
            console.log(`   + Synced Sub: ${sub.name}`);
        }

        console.log('🌱 Migrating existing product subcategories...');
        await WearProduct.updateMany({ subCategory: 'Mobiles' }, { $set: { subCategory: 'Smartphones' } });

        const products = [
            {
                sellerId: SELLER_ID,
                productName: 'V-Neck Cotton T-Shirt',
                description: 'Premium V-neck t-shirt for daily use.',
                category: "Men's Wear",
                subCategory: 'T-Shirts',
                catalogId: 'CAT-M-TSH-001',
                images: ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80'],
                status: 'active',
                variants: [{ size: 'M', color: 'White', listingPrice: 599, mrp: 1199, stock: 100, skuId: 'VNEK-WHT' }]
            },
            {
                sellerId: SELLER_ID,
                productName: 'Round Neck Summer Tee',
                description: 'Cool and comfortable for summer.',
                category: "Men's Wear",
                subCategory: 'T-Shirts',
                catalogId: 'CAT-M-TSH-002',
                images: ['https://images.unsplash.com/photo-1576566582149-13af3b1f08e1?w=800&q=80'],
                status: 'active',
                variants: [{ size: 'L', color: 'Black', listingPrice: 499, mrp: 899, stock: 80, skuId: 'RND-BLK' }]
            },
            {
                sellerId: SELLER_ID,
                productName: 'iPhone 15 Pro Max',
                description: 'The latest iPhone with Titanium finish.',
                category: "Electronics",
                subCategory: 'Smartphones',
                catalogId: 'CAT-E-MOB-001',
                images: ['https://images.unsplash.com/photo-1696446701796-da61225697cc?w=800&q=80'],
                status: 'active',
                variants: [{ size: '256GB', color: 'Titanium', listingPrice: 159900, mrp: 159900, stock: 10, skuId: 'IPH-15PRO' }]
            },
            {
                sellerId: SELLER_ID,
                productName: 'Samsung Galaxy S24 Ultra',
                description: 'The ultimate AI smartphone.',
                category: "Electronics",
                subCategory: 'Smartphones',
                catalogId: 'CAT-E-MOB-002',
                images: ['https://images.unsplash.com/photo-1707204533038-f14f1776961a?w=800&q=80'],
                status: 'active',
                variants: [{ size: '512GB', color: 'Gray', listingPrice: 129000, mrp: 139000, stock: 8, skuId: 'S24-ULTRA' }]
            },
            {
                sellerId: SELLER_ID,
                productName: 'MacBook Air M2',
                description: 'Thinner, lighter, and faster.',
                category: "Electronics",
                subCategory: 'Laptops',
                catalogId: 'CAT-E-LAP-001',
                images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80'],
                status: 'active',
                variants: [{ size: '8GB/256GB', color: 'Midnight', listingPrice: 99900, mrp: 114900, stock: 5, skuId: 'MBA-M2' }]
            },
            {
                sellerId: SELLER_ID,
                productName: 'Dell XPS 13',
                description: 'Compact and powerful ultraportable.',
                category: "Electronics",
                subCategory: 'Laptops',
                catalogId: 'CAT-E-LAP-002',
                images: ['https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800&q=80'],
                status: 'active',
                variants: [{ size: '16GB/512GB', color: 'Silver', listingPrice: 115000, mrp: 125000, stock: 3, skuId: 'XPS-13' }]
            }
        ];

        console.log('🌱 Seeding Products...');
        for (const prod of products) {
            await WearProduct.findOneAndUpdate(
                { productName: prod.productName, sellerId: prod.sellerId },
                prod,
                { upsert: true, new: true }
            );
        }

        console.log('✅ Seeding complete!');
        process.exit();
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

seedData();
