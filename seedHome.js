require('dotenv').config();
const mongoose = require('mongoose');
const HomeContent = require('./models/Awareness/homeContentModel');
const GlobalSetting = require('./models/Awareness/globalSettingModel');

const data = [
    {
        sectionKey: 'stats_baseline',
        isSetting: true, // internal flag for loop
        value: {
            farmers: 12450,
            acres: 45000,
            stories: 850,
            guides: 120
        }
    },
    {
        sectionKey: 'impact',
        title: "Jeenora Awareness",
        subtitle: "Social Impact",
        description: "We believe every purchase has the power to do good. Jeenora Awareness links our lifestyle products to real social causes.",
        cards: [
            {
                title: "Environmental Campaigns",
                body: "Our environmental arm runs year-round campaigns to educate communities about sustainability, reduce plastic consumption, and promote eco-conscious living.",
                points: ["Plastic-Free Living Workshops", "Community Clean-Up Drives", "Eco Product Lines", "Sustainable Fashion Education", "Carbon Offset Partnerships"],
                color: "border-amber-500"
            },
            {
                title: "Direct Consumer Cause Products",
                body: "Our product lines are tied directly to social causes. A percentage of every sale goes toward one of our active programs.",
                points: ["Cause-Linked Product Collections", "Monthly Impact Reports", "Charity Revenue Sharing", "Ethical Sourcing Standards", "Customer Voting on Causes"],
                color: "border-emerald-500"
            },
            {
                title: "Youth & Education",
                body: "We fund scholarships, run skills workshops, and partner with educational institutions to give young people real opportunities.",
                points: ["University Scholarships", "Skills Training Bootcamps", "NGO & School Partnerships", "Youth Business Mentoring", "Free Online Learning Resources"],
                color: "border-[var(--royal-gold)]"
            },
            {
                title: "Health & Wellbeing",
                body: "Mental health, physical wellness, and emotional balance are at the core of a fulfilled life.",
                points: ["Mental Health Awareness Campaigns", "Free Community Health Seminars", "Corporate Wellness Programs", "Wellness Product Curation", "Partnerships with Healthcare Professionals"],
                color: "border-red-500"
            }
        ]
    },
    {
        sectionKey: 'branches',
        title: "Every Branch Has a Purpose",
        description: "Every branch of Jeenora was built to solve a specific need. Together, they form a complete ecosystem.",
        cards: [
            {
                name: "Jeenora Direct",
                tag: "Core Brand",
                desc: "We source and sell high-quality consumer products directly to our customers. No middlemen, no compromise.",
                tags: ["Direct Sales", "Online Shop", "Subscription Boxes", "Loyalty Rewards"],
                color: "bg-emerald-600",
                icon: "ShoppingCart",
                link: "/benefits"
            },
            {
                name: "Jeenora Awareness",
                tag: "Social Wing",
                desc: "We believe every purchase has the power to do good. Jeenora Awareness links our products to real social causes.",
                tags: ["Cause Campaigns", "Community Events", "NGO Partnerships", "Educational Content"],
                color: "bg-[var(--royal-gold)]",
                icon: "Users",
                link: "/guide"
            },
            {
                name: "Jeenora+ Fashion",
                tag: "Fashion House",
                desc: "Your ultimate fashion destination. We source the finest dresses and accessories from global suppliers.",
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
            { icon: "Rocket", title: "Mission", desc: "Deliver quality, awareness, and value through every product, campaign, and consultation we offer." },
            { icon: "Sparkles", title: "Values", desc: "Integrity, creativity, sustainability, excellence, and genuine care for people and planet." },
            { icon: "Globe", title: "Our Reach", desc: "Operating across 12+ countries, serving consumers and businesses of all sizes." }
        ]
    }
];

const seed = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log("Connected to DB");
        for (const item of data) {
            if (item.isSetting) {
                await GlobalSetting.findOneAndUpdate({ key: item.sectionKey }, { value: item.value }, { upsert: true });
            } else {
                await HomeContent.findOneAndUpdate({ sectionKey: item.sectionKey }, item, { upsert: true });
            }
        }
        console.log("Seeded Home content and settings successfully");
        process.exit();
    } catch (err) {
        console.error("Seed failed:", err.message);
        process.exit(1);
    }
}

seed();
