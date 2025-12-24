const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Job = require('./models/hire/JobModel');

dotenv.config();

const seedJobs = async () => {
    try {
        await mongoose.connect(process.env.DB_URL || 'mongodb://localhost:27017/jeenora', {
        });

        console.log('Connected to DB');

        const dummyJobs = [
            {
                title: 'Senior React Developer',
                company: {
                    name: 'TechFlow Systems',
                    logo: 'https://ui-avatars.com/api/?name=TechFlow&background=0D8ABC&color=fff',
                    about: 'Leading provider of cloud solutions.',
                    size: '200-500'
                },
                description: 'We are looking for an experienced React developer to lead our frontend team. You will be responsible for architecting and building scalable UI components.',
                requirements: {
                    mustHave: ['React', 'Redux', 'JavaScript', 'Tailwind'],
                    goodToHave: ['Next.js', 'TypeScript', 'AWS'],
                    experience: { min: 3, max: 7 },
                    education: ['B.Tech/B.E.']
                },
                location: { city: 'Bangalore', country: 'India', isRemote: true },
                jobType: 'full-time',
                salary: { min: 1500000, max: 2500000, isDisclosed: true },
                application: { creditsRequired: 5 },
                status: 'active'
            },
            {
                title: 'Junior Backend Engineer',
                company: {
                    name: 'DataMinds',
                    logo: 'https://ui-avatars.com/api/?name=DataMinds&background=22c55e&color=fff',
                    about: 'AI and Data Analytics startup.',
                    size: '50-200'
                },
                description: 'Join our backend team to build robust APIs using Node.js and MongoDB.',
                requirements: {
                    mustHave: ['Node.js', 'Express', 'MongoDB'],
                    goodToHave: ['Python', 'Docker'],
                    experience: { min: 1, max: 3 },
                    education: ['BCA/MCA']
                },
                location: { city: 'Pune', country: 'India', isRemote: false },
                jobType: 'full-time',
                salary: { min: 600000, max: 1200000, isDisclosed: true },
                application: { creditsRequired: 3 },
                status: 'active'
            },
            {
                title: 'Freelance UI/UX Designer',
                company: {
                    name: 'CreativeStudio',
                    logo: 'https://ui-avatars.com/api/?name=Creative&background=f59e0b&color=fff',
                    about: 'Design agency focused on mobile apps.',
                    size: '10-50'
                },
                description: 'We need a creative designer for a 3-month project redesigning our mobile app.',
                requirements: {
                    mustHave: ['Figma', 'Adobe XD', 'Prototyping'],
                    goodToHave: ['HTML/CSS'],
                    experience: { min: 2, max: 5 }
                },
                location: { city: 'Remote', country: 'India', isRemote: true },
                jobType: 'contract',
                salary: { min: 50000, max: 80000, currency: 'INR', isDisclosed: true },
                application: { creditsRequired: 2 },
                status: 'active'
            }
        ];

        await Job.create(dummyJobs);
        console.log('Dummy jobs seeded!');
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seedJobs();
