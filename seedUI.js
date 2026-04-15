const mongoose = require('mongoose');
const WearCategory = require('./models/wear/wearCategoryModel');
const WearBanner = require('./models/wear/wearBannerModel');
require('dotenv').config();

const categories = [
    { 
        name: "Sarees", 
        image: "https://res.cloudinary.com/dxh6gsda4/image/upload/v1711964100/samples/ecommerce/cat-saree.jpg", 
        slug: "sarees",
        level: 0,
        status: "active"
    },
    { 
        name: "Kurtis", 
        image: "https://res.cloudinary.com/dxh6gsda4/image/upload/v1711964100/samples/ecommerce/cat-kurti.jpg", 
        slug: "kurtis",
        level: 0,
        status: "active"
    },
    { 
        name: "Suits", 
        image: "https://res.cloudinary.com/dxh6gsda4/image/upload/v1711964100/samples/ecommerce/cat-suit.jpg", 
        slug: "suits",
        level: 0,
        status: "active"
    }
];

const banners = [
    { 
        title: "Exclusive Silk Collection",
        image: "https://res.cloudinary.com/dxh6gsda4/image/upload/v1711964100/samples/ecommerce/banner-1.jpg",
        bannerType: "hero",
        offerZones: ["home"],
        actionType: "category",
        actionValue: "sarees",
        isActive: true,
        priority: 10
    },
    { 
        title: "Summer Flash Sale",
        image: "https://res.cloudinary.com/dxh6gsda4/image/upload/v1711964100/samples/ecommerce/banner-2.jpg",
        bannerType: "strip",
        offerZones: ["home"],
        actionType: "category",
        actionValue: "kurtis",
        isActive: true,
        priority: 5
    }
];

const seedUI = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('✅ Database connected');

        await WearCategory.deleteMany({ level: 0 });
        await WearCategory.insertMany(categories);
        console.log('✅ WearCategories seeded');

        await WearBanner.deleteMany({ offerZones: "home" });
        await WearBanner.insertMany(banners);
        console.log('✅ WearBanners seeded');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding UI data:', error);
        process.exit(1);
    }
};

seedUI();
