const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const Farmer = require('../models/Awareness/farmerModel');

async function updateFarmers() {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('Connected to DB');

        const farmers = await Farmer.find({});
        for (const farmer of farmers) {
            farmer.points = Math.floor(Math.random() * 2000) + 500;
            farmer.consults = Math.floor(Math.random() * 20) + 5;
            farmer.impactCore = (Math.random() * 5 + 4).toFixed(1);
            farmer.rank = 'Expert';
            await farmer.save();
            console.log(`Updated farmer: ${farmer.email}`);
        }

        console.log('All farmers updated with dynamic stats.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

updateFarmers();
