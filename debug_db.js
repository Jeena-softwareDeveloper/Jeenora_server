const mongoose = require('mongoose');
const Application = require('./models/hire/ApplicationModel');
const JobPost = require('./models/hire/JobPostModel');
const HireUser = require('./models/hire/hireUserModel'); // Assuming this exists for context
require('dotenv').config();

const dbUrl = process.env.DB_URL || 'mongodb://127.0.0.1:27017/jeenora_hire'; // Adjust/verify logic if env not loaded

async function debugData() {
    try {
        await mongoose.connect(dbUrl);
        console.log('Connected to DB');

        console.log('--- FINDING ALL APPLICATIONS ---');
        const apps = await Application.find({}).limit(5).lean();
        console.log(`Found ${apps.length} applications (limit 5).`);

        for (const app of apps) {
            console.log(`\nApp ID: ${app._id}`);
            console.log(`  User ID: ${app.userId}`);
            console.log(`  Job ID: ${app.jobId}`);
            console.log(`  Employer ID: ${app.employerId}`);
            console.log(`  Status: ${app.currentStatus}`);

            // Check if job exists
            const job = await JobPost.findById(app.jobId).lean();
            if (job) {
                console.log(`  -> Linked Job Found: "${job.title}"`);
                console.log(`     Job Employer ID: ${job.employerId}`);
            } else {
                console.log(`  -> Linked Job NOT FOUND! ID: ${app.jobId}`);
            }
        }

        console.log('\n--- FINDING ALL JOBS ---');
        const jobs = await JobPost.find({}).limit(5).lean();
        console.log(`Found ${jobs.length} jobs (limit 5).`);
        for (const job of jobs) {
            console.log(`Job ID: ${job._id}, Title: ${job.title}, Employer: ${job.employerId}`);
        }

    } catch (error) {
        console.error('Debug Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugData();
