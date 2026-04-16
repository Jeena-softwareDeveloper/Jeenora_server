const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const WearBanner = require('../models/wear/wearBannerModel');

async function seedMiniBanners() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.DB_URL);

        console.log('Purging existing mini banners...');
        await WearBanner.deleteMany({ bannerType: 'mini' });

        const miniBanners = [
            {
                title: 'Premium Men Topwear',
                image: 'https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?q=80&w=800',
                bannerType: 'mini',
                offerZones: ['home'],
                actionType: 'category',
                actionValue: 'men-topwear',
                priority: 10
            },
            {
                title: 'Ethnic Elegance',
                image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=800',
                bannerType: 'mini',
                offerZones: ['home'],
                actionType: 'category',
                actionValue: 'women-ethnic',
                priority: 9
            },
            {
                title: 'Luxury Jewellery',
                image: 'https://images.unsplash.com/photo-1515562141207-7a88bb7ce338?q=80&w=800',
                bannerType: 'mini',
                offerZones: ['home'],
                actionType: 'category',
                actionValue: 'womens-jewellery',
                priority: 8
            },
            {
                title: 'Elite Footwear',
                image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=800',
                bannerType: 'mini',
                offerZones: ['home'],
                actionType: 'category',
                actionValue: 'footwear',
                priority: 7
            }
        ];

        console.log(`Seeding ${miniBanners.length} mini banners...`);
        await WearBanner.insertMany(miniBanners);

        console.log('✅ Mini banners seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding Error:', error);
        process.exit(1);
    }
}

seedMiniBanners();
