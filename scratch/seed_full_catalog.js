const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

// Models
const WearCategory = require('../models/wear/wearCategoryModel');
const WearProduct = require('../models/wear/wearProductModel');
const LegacyCategory = require('../models/wear/categoryModel');
const LegacyProduct = require('../models/wear/productModel');
const ProductOffer = require('../models/wear/productOfferModel');
const WearBanner = require('../models/wear/wearBannerModel');

const DB_URL = process.env.DB_URL;
const SELLER_ID = '6986cfd9c98bac524d5ce299';

const catalogConfig = [
    {
        name: 'Women Ethnic', slug: 'women-ethnic', priority: 1, 
        img: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=500',
        subs: ['Sarees', 'Kurtis', 'Lehengas', 'Suits', 'Palazzos', 'Leggings']
    },
    {
        name: 'Women Western', slug: 'women-western', priority: 2, 
        img: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&w=500',
        subs: ['Dresses', 'Tops', 'Jeans', 'Skirts', 'T-shirts', 'Jumpsuits']
    },
    {
        name: 'Men Topwear', slug: 'men-topwear', priority: 3, 
        img: 'https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?q=80&w=500',
        subs: ['Casual Shirts', 'Polo T-shirts', 'Hoodies', 'Sweaters', 'Denim Jackets', 'Vests']
    },
    {
        name: 'Men Bottomwear', slug: 'men-bottomwear', priority: 4, 
        img: 'https://images.unsplash.com/photo-1473966968600-fa804b86827b?q=80&w=500',
        subs: ['Slim Fit Jeans', 'Formal Trousers', 'Cotton Shorts', 'Trackpants', 'Chinos', 'Cargo Pants']
    },
    {
        name: 'Kids Fashion', slug: 'kids-fashion', priority: 5, 
        img: 'https://images.unsplash.com/photo-1514090458221-65bb69af63e4?q=80&w=500',
        subs: ['Boys Clothing', 'Girls Clothing', 'Baby Wear', 'Kids Shoes', 'Toys', 'Kids Accessories']
    },
    {
        name: 'Footwear', slug: 'footwear', priority: 6, 
        img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=500',
        subs: ['Sneakers', 'Boots', 'Loafers', 'Sandals', 'Heels', 'Slippers']
    },
    {
        name: 'Beauty', slug: 'beauty-care', priority: 7, 
        img: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=500',
        subs: ['Makeup', 'Skincare', 'Haircare', 'Fragrance', 'Bath & Body', 'Beauty Tools']
    },
    {
        name: 'Accessories', slug: 'fashion-accessories', priority: 8, 
        img: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?q=80&w=500',
        subs: ['Smart Watches', 'Sunglasses', 'Leather Belts', 'Wallets', 'Handbags', 'Silk Scarves']
    },
    {
        name: 'Home & Living', slug: 'home-living', priority: 9, 
        img: 'https://images.unsplash.com/photo-1484101403633-562f891dc89a?q=80&w=500',
        subs: ['Bed Linen', 'Curtains', 'Table Lamps', 'Wall Decor', 'Kitchenware', 'Furniture']
    },
    {
        name: 'Jewellery', slug: 'womens-jewellery', priority: 10, 
        img: 'https://images.unsplash.com/photo-1515562141207-7a88fb0ce33e?q=80&w=500',
        subs: ['Gold Rings', 'Diamond Necklaces', 'Earrings', 'Bracelets', 'Traditional Bangles', 'Anklets']
    }
];

const seedFullCatalog = async () => {
    try {
        console.log('Connecting...');
        await mongoose.connect(DB_URL);
        
        console.log('Purging database...');
        await WearCategory.deleteMany({});
        await WearProduct.deleteMany({});
        await LegacyCategory.deleteMany({});
        await LegacyProduct.deleteMany({});
        await ProductOffer.deleteMany({});
        await WearBanner.deleteMany({});

        const offer = await ProductOffer.create({
            offerName: "Special Deal", tag: "HOT", title: "Flat 30% OFF", 
            subtitle: "Best Sellers", icon: "ticket-percent", priority: 1
        });

        const seedProductsForNode = async (mainCategory, subCategory, nodeImg) => {
            const productsPerNode = 8;
            for (let i = 1; i <= productsPerNode; i++) {
                const uniqueId = Math.random().toString(36).substring(7).toUpperCase();
                // Naming requested by user: [Main Cat] - [Sub Cat] - Product [Index]
                const displayName = `${mainCategory} - ${subCategory} - Product ${i}`;
                
                const basePrice = 499 + (Math.floor(Math.random() * 2000));
                const discountAmount = Math.floor(Math.random() * 500);
                const finalPrice = basePrice - discountAmount;

                await WearProduct.create({
                    sellerId: SELLER_ID, 
                    productName: displayName, 
                    category: mainCategory, 
                    subCategory: subCategory,
                    description: `This is a high quality ${displayName} from the ${mainCategory} collection. Premium quality and unique design.`,
                    images: [nodeImg], 
                    status: 'active', 
                    isPrimary: true, 
                    catalogId: `JN-${uniqueId}`,
                    variants: [{ 
                        size: 'M', 
                        color: 'Standard', 
                        listingPrice: finalPrice, 
                        mrp: basePrice, 
                        stock: 50 
                    }],
                    offers: [offer._id]
                });

                await LegacyProduct.create({
                    sellerId: SELLER_ID, 
                    name: `${displayName} (Legacy)`, 
                    slug: `${displayName.toLowerCase().replace(/ /g, '-')}-${uniqueId.toLowerCase()}`,
                    category: mainCategory, 
                    brand: 'Jeenora', 
                    price: finalPrice, 
                    stock: 50, 
                    discount: Math.floor((discountAmount/basePrice)*100),
                    description: `Classic version of ${displayName}. Durable and authentic.`,
                    shopName: 'Jeenora Global', 
                    images: [nodeImg], 
                    status: 'active'
                });
            }
        };

        console.log(`Seeding 10 Main Categories, 60 Sub Categories, and 480 Products...`);
        
        for (const main of catalogConfig) {
            const mainNode = await WearCategory.create({
                name: main.name, 
                image: main.img, 
                slug: main.slug, 
                level: 0, 
                priority: main.priority
            });
            await LegacyCategory.create({ 
                name: main.name, 
                image: main.img, 
                slug: main.slug, 
                priority: main.priority 
            });
            
            console.log(`[Main] ${main.name} (Priority: ${main.priority})`);
            
            for (let subIdx = 0; subIdx < main.subs.length; subIdx++) {
                const subName = main.subs[subIdx];
                const subSlug = `${main.slug}-${subName.toLowerCase().replace(/ /g, '-')}`;
                const subPriority = (main.priority * 100) + subIdx; // Unique priorities for subcategories too

                await WearCategory.create({
                    name: subName, 
                    image: main.img, 
                    slug: subSlug, 
                    level: 1, 
                    parentId: mainNode._id, 
                    priority: subPriority
                });
                await LegacyCategory.create({ 
                    name: subName, 
                    image: main.img, 
                    slug: subSlug, 
                    priority: subPriority 
                });
                
                // Seed 8 products for each Sub Category
                await seedProductsForNode(main.name, subName, main.img);
            }
        }

        console.log('\nDATABASE FULLY HYDRATED! 🚀');
        console.log('- 10 Main Categories (Prioritized 1-10)');
        console.log('- 60 Sub Categories (6 per main)');
        console.log('- 480 Products (8 per sub-category)');
        console.log('Naming: [Main] - [Sub] - Product [X]');
        process.exit(0);
    } catch (error) {
        console.error('SEEDING FAILED ❌:', error.message);
        process.exit(1);
    }
};

seedFullCatalog();
