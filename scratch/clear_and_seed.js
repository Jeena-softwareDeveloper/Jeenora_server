const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

// Models
const WearCategory = require('../models/wear/wearCategoryModel');
const WearProduct = require('../models/wear/wearProductModel');
const LegacyCategory = require('../models/wear/categoryModel');
const LegacyProduct = require('../models/wear/productModel');
const WearBanner = require('../models/wear/wearBannerModel');
const ProductOffer = require('../models/wear/productOfferModel');
const WearOfferCampaign = require('../models/wear/wearOfferCampaignModel');

const DB_URL = process.env.DB_URL;
const SELLER_ID = '6986cfd9c98bac524d5ce299';

const fashionConfig = [
    {
        name: 'Women Ethnic', slug: 'women-ethnic', priority: 100, img: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=500',
        subs: [
            { name: 'Bridal Sarees', slug: 'bridal-sarees' },
            { name: 'Designer Kurtis', slug: 'designer-kurtis' },
            { name: 'Heavy Lehengas', slug: 'heavy-lehengas' },
            { name: 'Party Suits', slug: 'party-suits' }
        ]
    },
    {
        name: 'Women Western', slug: 'women-western', priority: 95, img: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&w=500',
        subs: [
            { name: 'Party Dresses', slug: 'party-dresses' },
            { name: 'Office Tops', slug: 'office-tops' },
            { name: 'Slim Fit Jeans', slug: 'slim-jeans' },
            { name: 'Activewear', slug: 'women-active' }
        ]
    },
    {
        name: 'Men Topwear', slug: 'men-topwear', priority: 90, img: 'https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?q=80&w=500',
        subs: [
            { name: 'Casual T-Shirts', slug: 'casual-tshirts' },
            { name: 'Formal Shirts', slug: 'formal-shirts' },
            { name: 'Winter Hoodies', slug: 'winter-hoodies' },
            { name: 'Denim Jackets', slug: 'denim-jackets' }
        ]
    },
    {
        name: 'Men Bottomwear', slug: 'men-bottomwear', priority: 85, img: 'https://images.unsplash.com/photo-1473966968600-fa804b86827b?q=80&w=500',
        subs: [
            { name: 'Chino Trousers', slug: 'chino-trousers' },
            { name: 'Cargo Pants', slug: 'cargo-pants' },
            { name: 'Cotton Shorts', slug: 'cotton-shorts' },
            { name: 'Track Pants', slug: 'track-pants' }
        ]
    },
    {
        name: 'Kids Fashion', slug: 'kids-fashion', priority: 80, img: 'https://images.unsplash.com/photo-1514090458221-65bb69af63e4?q=80&w=500',
        subs: [
            { name: 'Newborn Sets', slug: 'newborn-sets' },
            { name: 'Kids T-Shirts', slug: 'kids-tshirts' },
            { name: 'Dungarees', slug: 'dungarees' },
            { name: 'School Suits', slug: 'school-suits' }
        ]
    },
    {
        name: 'Footwear', slug: 'footwear', priority: 75, img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=500',
        subs: [
            { name: 'Sports Sneakers', slug: 'sports-sneakers' },
            { name: 'Leather Boots', slug: 'leather-boots' },
            { name: 'Casual Loafers', slug: 'casual-loafers' },
            { name: 'Ethnic Juttis', slug: 'ethnic-juttis' }
        ]
    },
    {
        name: 'Beauty', slug: 'beauty-care', priority: 70, img: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=500',
        subs: []
    },
    {
        name: 'Accessories', slug: 'fashion-accessories', priority: 65, img: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?q=80&w=500',
        subs: []
    }
];

const seed = async () => {
    try {
        console.log('Connecting...');
        await mongoose.connect(DB_URL);
        
        console.log('Purging database...');
        await WearCategory.deleteMany({}); await WearProduct.deleteMany({});
        await LegacyCategory.deleteMany({}); await LegacyProduct.deleteMany({});
        await ProductOffer.deleteMany({}); await WearBanner.deleteMany({});

        const offer = await ProductOffer.create({
            offerName: "Grand Sale 10%", tag: "SALE", title: "10% OFF", subtitle: "Limited Time", priority: 1
        });

        const seedProductsForNode = async (mainName, subName, nodeImg) => {
            const products = [];
            for (let i = 1; i <= 4; i++) {
                const uniqueId = Math.random().toString(36).substring(7);
                const name = `${subName || mainName} - Unique Style ${i}`;
                const price = 299 + (i * 150) + Math.floor(Math.random() * 50);
                
                const wear = await WearProduct.create({
                    sellerId: SELLER_ID, productName: name, category: mainName, subCategory: subName || mainName,
                    images: [nodeImg], status: 'active', isPrimary: true, catalogId: `UNQ-${uniqueId}`,
                    variants: [{ size: 'Free', color: 'Custom', listingPrice: price, mrp: price + 300, stock: 100 }],
                    offers: [offer._id], description: `Premium unique ${name} from Jeenora Collection.`
                });

                await LegacyProduct.create({
                    sellerId: SELLER_ID, name: name, slug: `${name.toLowerCase().replace(/ /g, '-')}-${uniqueId}`,
                    category: mainName, brand: 'Jeenora', price: price, stock: 100, discount: 5,
                    description: `Premium unique ${name} from Jeenora Collection.`, shopName: 'Jeenora Store',
                    images: [nodeImg], status: 'active'
                });
            }
        };

        console.log('Seeding Nodes...');
        for (const main of fashionConfig) {
            const mainNode = await WearCategory.create({
                name: main.name, image: main.img, slug: main.slug, level: 0, priority: main.priority
            });
            await LegacyCategory.create({ name: main.name, image: main.img, slug: main.slug, priority: main.priority });
            
            console.log(`  Seeding Main: ${main.name}`);
            await seedProductsForNode(main.name, null, main.img);

            for (const sub of main.subs) {
                await WearCategory.create({
                    name: sub.name, image: main.img, slug: sub.slug, level: 1, parentId: mainNode._id, priority: 50
                });
                await LegacyCategory.create({ name: sub.name, image: main.img, slug: sub.slug, priority: 50 });
                
                console.log(`    - Seeding Sub: ${sub.name}`);
                await seedProductsForNode(main.name, sub.name, main.img);
            }
        }

        await WearBanner.create({
            title: 'MEGA SALE', image: fashionConfig[0].img, bannerType: 'mini', offerZones: ['home'],
            actionType: 'category', actionValue: fashionConfig[0].slug, priority: 1
        });

        console.log('\nHIGH DENSITY UNIQUE SEED COMPLETE! 🎉');
        process.exit(0);
    } catch (error) {
        console.error('FAILED:', error.message);
        process.exit(1);
    }
};
seed();
