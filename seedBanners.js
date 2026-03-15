require('dotenv').config();
const mongoose = require('mongoose');
const Banner = require('./models/Awareness/bannerModel');

const banners = [
    {
        title: "Pioneering Sustainable Change",
        slug: "pioneering-sustainable-change",
        description: "Join us in our mission to create a sustainable future through innovative fashion and awareness campaigns.",
        image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=2026&auto=format&fit=crop",
        startDate: new Date(),
        isActive: true
    },
    {
        title: "Empowering Rural Communities",
        slug: "empowering-rural-communities",
        description: "Through our Direct Consumer programs, we bridge the gap between global consumers and local artisans.",
        image: "https://images.unsplash.com/photo-1542601052-e427494a7cb0?q=80&w=2074&auto=format&fit=crop",
        startDate: new Date(),
        isActive: true
    },
    {
        title: "Premium Fashion, Conscious Choice",
        slug: "premium-fashion-conscious-choice",
        description: "Discover the latest trends in sustainable fashion. Elegance that respects the earth.",
        image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop",
        startDate: new Date(),
        isActive: true
    }
];

const seedBanners = async () => {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.DB_URL);
        console.log('Connected to DB');

        console.log('Clearing existing banners...');
        await Banner.deleteMany({});

        console.log('Seeding banners...');
        await Banner.insertMany(banners);
        
        console.log('✅ Banners seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding banners:', error.message);
        process.exit(1);
    }
};

seedBanners();
