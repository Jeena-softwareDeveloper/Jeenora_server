require('dotenv').config();
const mongoose = require('mongoose');

// Models
const Banner = require('../models/Awareness/bannerModel');
const HomeContent = require('../models/Awareness/homeContentModel');
const GlobalSetting = require('../models/Awareness/globalSettingModel');
const SuccessStory = require('../models/Awareness/successStoryModel');
const Pesticide = require('../models/Awareness/pesticideModel');
const Guide = require('../models/Awareness/guideModel');
const GuideCategory = require('../models/Awareness/guideCategoryModel');
const SocialCampaign = require('../models/Awareness/socialCampaignModel');
const Ticker = require('../models/Awareness/tickerModel');

const banners = [
    {
        title: "Cultivating Conscious Growth",
        slug: "cultivating-conscious-growth",
        description: "Empowering rural communities through sustainable agriculture and direct ethical trade cycles.",
        image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2000&auto=format&fit=crop",
        startDate: new Date(),
        isActive: true,
        cta_text: "Join Community",
        cta_link: "/community"
    },
    {
        title: "The Future is Organic",
        slug: "future-is-organic",
        description: "Zero-chemical protocols that restore soil health and deliver premium nutrition to your doorstep.",
        image: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?q=80&w=2000&auto=format&fit=crop",
        startDate: new Date(),
        isActive: true,
        cta_text: "Browse Guides",
        cta_link: "/guide"
    }
];

const homeContent = [
    {
        sectionKey: 'impact',
        title: "Jeenora Awareness",
        subtitle: "Social Impact",
        description: "We believe every purchase has the power to do good. Jeenora Awareness links our lifestyle products to real social causes.",
        cards: [
            {
                title: "Environmental Campaigns",
                body: "Our environmental arm runs year-round campaigns to educate communities about sustainability, reduce plastic consumption, and promote eco-conscious living. We partner with local governments and NGOs to make environmental responsibility accessible — not just aspirational.",
                points: ["Plastic-Free Living Workshops", "Community Clean-Up Drives", "Eco Product Lines", "Sustainable Fashion Education", "Carbon Offset Partnerships"],
                color: "border-amber-500"
            },
            {
                title: "Direct Consumer Cause Products",
                body: "Our product lines are tied directly to social causes. A percentage of every sale goes toward one of our active programs. We publish transparent impact reports so our customers can see exactly where their money goes and what difference it is making.",
                points: ["Cause-Linked Product Collections", "Monthly Impact Reports", "Charity Revenue Sharing", "Ethical Sourcing Standards", "Customer Voting on Causes"],
                color: "border-emerald-500"
            },
            {
                title: "Youth & Education",
                body: "We fund scholarships, run skills workshops, and partner with educational institutions to give young people real opportunities. Our youth entrepreneurship bootcamps have already helped hundreds of young people launch their own ventures.",
                points: ["University Scholarships", "Skills Training Bootcamps", "NGO & School Partnerships", "Youth Business Mentoring", "Free Online Learning Resources"],
                color: "border-[var(--royal-gold)]"
            },
            {
                title: "Health & Wellbeing",
                body: "Mental health and physical wellness are at the core of a fulfilled life. Jeenora's health wing produces educational content and hosts free wellness seminars backed by professional advisors and real research.",
                points: ["Mental Health Awareness Campaigns", "Free Community Health Seminars", "Corporate Wellness Programs", "Wellness Product Curation", "Partnerships with Healthcare Professionals"],
                color: "border-red-500"
            }
        ]
    },
    {
        sectionKey: 'branches',
        title: "Every Branch Has a Purpose",
        description: "Every branch of Jeenora was built to solve a specific need. Together, they form a complete ecosystem — shopping, awareness, fashion, and strategy all under one powerful brand.",
        cards: [
            {
                tag: "Core Brand",
                name: "Jeenora Direct",
                desc: "We source and sell high-quality consumer products directly to our customers. No middlemen, no compromise. Every product is selected for quality and value.",
                tags: ["Direct Sales", "Online Shop", "Subscription Boxes", "Loyalty Rewards"],
                color: "bg-emerald-600",
                icon: "ShoppingCart",
                link: "/benefits"
            },
            {
                tag: "Social Wing",
                name: "Jeenora Awareness",
                desc: "We believe every purchase has the power to do good. Jeenora Awareness links our products to real social causes — environmental, education, and health.",
                tags: ["Cause Campaigns", "Community Events", "NGO Partnerships", "Educational Content"],
                color: "bg-[var(--royal-gold)]",
                icon: "Users",
                link: "/guide"
            },
            {
                tag: "Fashion House",
                name: "Jeenora+ Fashion",
                desc: "Your ultimate fashion destination. We source the finest dresses and accessories from global suppliers and deliver them at the best prices.",
                tags: ["Women's Fashion", "Wholesale Orders", "Retail Partnerships", "Custom Bulk Orders"],
                color: "bg-red-700",
                icon: "Shirt",
                link: "/community"
            }
        ]
    },
    {
        sectionKey: 'about',
        title: "We Are More Than a Brand",
        subtitle: "Who We Are",
        description: "Jeenora was born from a simple but powerful idea — that a business can do more than make money. It can create awareness, inspire communities, dress people beautifully, and help other businesses grow.",
        descriptionSecondary: "From our roots in social awareness campaigns to expanding into premium fashion and professional consulting — every step Jeenora takes is intentional, purposeful, and customer-first.",
        cards: [
            { icon: "Target", title: "Vision", desc: "To be the most trusted lifestyle and business brand across every market we enter." },
            { icon: "Rocket", title: "Mission", desc: "Deliver quality, awareness, and value through every product, campaign, and consultation." },
            { icon: "Sparkles", title: "Values", desc: "Integrity, creativity, sustainability, excellence, and genuine care for people." },
            { icon: "Globe", title: "Our Reach", desc: "Serving consumers, wholesalers, and businesses across multiple regions with global standards." }
        ]
    }
];

const successStories = [
    {
        heading: "Transforming Dry Land into a Green Heaven",
        slug: "dry-land-to-green-heaven",
        name: "Arumugam S.",
        area: "Dharmapuri, TN",
        description: "Arumugam was struggling with water scarcity and soil degradation. After adopting Jeenora's drip irrigation and vermicompost protocols, his yield increased by 40%.",
        experience: "Yield grew from 2 tons to 2.8 tons in a single season.",
        image: "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?q=80&w=2000&auto=format&fit=crop",
    },
    {
        heading: "Community-Led Organic Movement",
        slug: "community-organic-movement",
        name: "Lakshmi M.",
        area: "Tirunelveli, TN",
        description: "Lakshmi mobilized 50 women in her village to switch to organic rice cultivation. Jeenora provided the training and marketplace links.",
        experience: "50+ families now earn 25% more through premium organic sales.",
        image: "https://images.unsplash.com/photo-1590682680695-43b964a3ae17?q=80&w=2000&auto=format&fit=crop",
    }
];

const pesticides = [
    {
        name: "Neem Power Elite",
        category: "Organic",
        description: "High-concentration cold-pressed neem extraction for broad-spectrum pest control.",
        image: "https://images.unsplash.com/photo-1628352081506-83c43123ed6d?q=80&w=1000&auto=format&fit=crop",
        effectiveness_rating: 5,
        safetyRating: "Safe",
        pest_targets: ["Aphids", "Whiteflies", "Caterpillars"],
        application_type: "Spray",
        usage_guide: "Dilute 5ml per liter of water. Apply at sunset."
    },
    {
        name: "Bio-Shield B.t.",
        category: "Biological",
        description: "Microbial agent specifically targeting larvae without harming beneficial insects.",
        image: "https://images.unsplash.com/photo-1592179900431-1e021ea5c783?q=80&w=1000&auto=format&fit=crop",
        effectiveness_rating: 4,
        safetyRating: "Safe",
        pest_targets: ["Leaf Miners", "Bollworms"],
        application_type: "Foliar Spray",
        usage_guide: "Apply when first signs of larvae appear. Re-apply after rain."
    },
    {
        name: "Trichoderma Viride",
        category: "Preventive",
        description: "Bio-fungicide that protects roots from fungal pathogens and enhances plant immunity.",
        image: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?q=80&w=1000&auto=format&fit=crop",
        effectiveness_rating: 5,
        safetyRating: "Safe",
        pest_targets: ["Root Rot", "Wilt Disease"],
        application_type: "Soil Treatment",
        usage_guide: "Mix 1kg with 50kg farmyard manure. Apply near root zone."
    }
];

const socialCampaigns = [
    {
        title: "Plastic-Free Delta Initiative",
        description: "Cleaning up the Cauvery delta and educating local vendors on biodegradable packaging alternatives.",
        image: "https://images.unsplash.com/photo-1595278069441-2cf29f8005a4?q=80&w=2000&auto=format&fit=crop",
        status: "Active",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        location: "Thanjavur, TN",
        participants: 1250,
        isHot: true
    },
    {
        title: "Soil Revival Program 2025",
        description: "Distributing organic microbial culture to 5000 small-scale farmers to restore soil biodiversity.",
        image: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?q=80&w=2000&auto=format&fit=crop",
        status: "Active",
        startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        location: "Erode, TN",
        participants: 3400,
        isHot: true
    },
    {
        title: "Kanyakumari Reforestation",
        description: "Planting 10,000 indigenous trees across the coastal belt to prepare for monsoon impacts.",
        image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=2000&auto=format&fit=crop",
        status: "Completed",
        startDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        location: "Kanyakumari, TN",
        participants: 2100,
        isHot: false
    }
];

const tickers = [
    { text: "Organic Harvest Festival starts next week in Coimbatore!", link: "/community", isActive: true },
    { text: "Join our Plastic-Free campaign and earn 50 awareness points.", link: "/campaigns", isActive: true },
    { text: "New Guide: Sustainable Rice Cultivation released.", link: "/guide", isActive: true },
    { text: "Jeenora+ Fashion Summer Collection Launch - 10% proceeds to Education Fund.", link: "/community", isActive: true }
];

async function seed() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.DB_URL);
        
        console.log('Clearing existing awareness data...');
        await Banner.deleteMany({});
        await HomeContent.deleteMany({});
        await SuccessStory.deleteMany({});
        await Pesticide.deleteMany({});
        await Guide.deleteMany({});
        await GuideCategory.deleteMany({});
        await SocialCampaign.deleteMany({});
        await Ticker.deleteMany({});
        await GlobalSetting.deleteOne({ key: 'stats_baseline' });

        console.log('Seeding Banners...');
        await Banner.insertMany(banners);

        console.log('Seeding Home Content...');
        for (const item of homeContent) {
            await HomeContent.create(item);
        }

        console.log('Seeding Tickers...');
        await Ticker.insertMany(tickers);

        console.log('Seeding Social Campaigns...');
        await SocialCampaign.insertMany(socialCampaigns);

        console.log('Seeding Global Settings...');
        await GlobalSetting.create({
            key: 'stats_baseline',
            value: {
                farmers: 15200,
                acres: 52000,
                stories: 920,
                guides: 150
            }
        });

        console.log('Seeding Success Stories...');
        await SuccessStory.insertMany(successStories);

        console.log('Seeding Pesticides...');
        await Pesticide.insertMany(pesticides);

        console.log('Seeding Professional Guides...');
        const categoriesList = [
            { name: 'Soil Health', slug: 'soil-health' },
            { name: 'Pest Control', slug: 'pest-control' },
            { name: 'Water Management', slug: 'water-management' }
        ];
        const categoryMap = {};
        for (const cat of categoriesList) {
            const created = await GuideCategory.create(cat);
            categoryMap[cat.name] = created._id;
        }

        const guides = [
            { title: 'Organic Composting 101', cat: 'Soil Health', diff: 'Beginner', desc: 'The foundation of healthy farming begins with the soil.' },
            { title: 'Integrated Pest Management', cat: 'Pest Control', diff: 'Intermediate', desc: 'Balance your ecosystem with smart pest management strategies.' },
            { title: 'Solar Drip Systems', cat: 'Water Management', diff: 'Advanced', desc: 'Modernizing water delivery with renewable energy.' }
        ];

        for (const g of guides) {
            await Guide.create({
                category: categoryMap[g.cat],
                heading: g.title,
                slug: g.title.toLowerCase().replace(/ /g, '-'),
                level: g.diff,
                difficulty: g.diff,
                description: g.desc,
                content: `<div class="prose"><h3>${g.title}</h3><p>Detailed guide on how to implement ${g.title} effectively...</p></div>`,
                readTime: '15m read',
                crops: ['Multiple Crops'],
                isActive: true
            });
        }

        console.log('✅✅ FINAL Production-Grade Seed Completed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
}

seed();
