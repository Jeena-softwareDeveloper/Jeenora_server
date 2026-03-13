const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import Models
const Job = require('../models/hire/JobModel');
const PlanSettings = require('../models/hire/planSettingodel');
const CreditSetting = require('../models/hire/creditSettingModel');
const StaticContent = require('../models/hire/staticContentModel');

// Seed Data
const dummyJobs = [
    {
        title: 'Senior React Developer',
        company: { name: 'TechFlow Systems', logo: 'https://ui-avatars.com/api/?name=TechFlow&background=0D8ABC&color=fff', about: 'Leading provider of cloud solutions.', size: '200-500' },
        description: 'We are looking for an experienced React developer to lead our frontend team.',
        requirements: { mustHave: ['React', 'Redux', 'JavaScript', 'Tailwind'], goodToHave: ['Next.js', 'TypeScript'], experience: { min: 3, max: 7 }, education: ['B.Tech/B.E.'] },
        location: { city: 'Bangalore', country: 'India', isRemote: true },
        jobType: 'full-time',
        salary: { min: 1500000, max: 2500000, isDisclosed: true },
        application: { creditsRequired: 5 },
        status: 'active'
    },
    {
        title: 'Junior Backend Engineer',
        company: { name: 'DataMinds', logo: 'https://ui-avatars.com/api/?name=DataMinds&background=22c55e&color=fff', about: 'AI and Data Analytics.', size: '50-200' },
        description: 'Join our backend team to build robust APIs using Node.js and MongoDB.',
        requirements: { mustHave: ['Node.js', 'Express', 'MongoDB'], experience: { min: 1, max: 3 }, education: ['BCA/MCA'] },
        location: { city: 'Pune', country: 'India', isRemote: false },
        jobType: 'full-time',
        salary: { min: 600000, max: 1200000, isDisclosed: true },
        application: { creditsRequired: 3 },
        status: 'active'
    },
    {
        title: 'Freelance UI/UX Designer',
        company: { name: 'CreativeStudio', logo: 'https://ui-avatars.com/api/?name=Creative&background=f59e0b&color=fff', about: 'Design agency.', size: '10-50' },
        description: 'We need a creative designer for a 3-month project.',
        requirements: { mustHave: ['Figma', 'Adobe XD'], experience: { min: 2, max: 5 } },
        location: { city: 'Remote', country: 'India', isRemote: true },
        jobType: 'contract',
        salary: { min: 50000, max: 80000, currency: 'INR', isDisclosed: true },
        application: { creditsRequired: 2 },
        status: 'active'
    }
];

const staticSeedData = [
    {
        page: 'pricing',
        content: {
            faqs: [
                { q: 'How do credits work exactly?', a: "Credits are our platform's focus currency. Each credit allows you to perform one 'Platinum Action'—like sending a professionally-enhanced application, requesting an expert review, or initiating a direct employer chat. They never expire and rollover month-to-month." },
                { q: 'Does Jeenora guarantee a job?', a: "While we can't guarantee a final offer (that depends on the interview!), we do guarantee transparency and high-intent matching. Our users see a 78% response rate compared to the 15% industry average on traditional sites." }
            ],
            successMetrics: [
                { metric: 'Avg. Hired Time', value: '18 Days', trend: 'down' },
                { metric: 'Interview Rate', value: '78%', trend: 'up' }
            ],
            creditFeatures: [
                { icon: '⚡', title: 'Zero Lock-in', desc: 'No subscription commitment required' },
                { icon: '🔄', title: 'Rollover Forever', desc: 'Unused credits never expire' },
                { icon: '💎', title: 'Bulk Savings', desc: 'Save up to 35% with larger packages' }
            ],
            cta: { title: "Ready to Invest in Your Career?", buttonText: "Get Free Credits" }
        }
    }
];

const runSeed = async () => {
    try {
        console.log('Connecting to DB:', process.env.DB_URL);
        await mongoose.connect(process.env.DB_URL);
        console.log('✅ Connected.');

        // 1. Seed Plans
        console.log('🌱 Seeding Plan Settings...');
        await PlanSettings.deleteMany({});
        const planSettings = await PlanSettings.getSettings();
        planSettings.plansComingSoon = false;
        await planSettings.save();
        console.log('✅ Plans Active.');

        // 2. Seed Credit Settings
        console.log('🌱 Seeding Credit Settings...');
        await CreditSetting.deleteMany({});
        const creditSettings = await CreditSetting.getSettings();
        creditSettings.creditsComingSoon = false;
        await creditSettings.save();
        console.log('✅ Credit Settings Active.');

        // 3. Seed Jobs
        console.log('🌱 Seeding Jobs...');
        await Job.deleteMany({});
        await Job.create(dummyJobs);
        console.log('✅ Jobs Seeded.');

        // 4. Seed Static Content
        console.log('🌱 Seeding Static Content...');
        await StaticContent.deleteMany({});
        await StaticContent.insertMany(staticSeedData);
        console.log('✅ Static Content Seeded.');

        console.log('✅✅ Master Seed Completed Successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Seed Failed:', error);
        process.exit(1);
    }
};

runSeed();
