require('dotenv').config();
const mongoose = require('mongoose');
const Farmer = require('../models/Awareness/farmerModel');

const checkFarmers = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log("✅ Database connected.");

        const farmers = await Farmer.find({});
        console.log(`Found ${farmers.length} farmers:`);
        farmers.forEach(f => {
            console.log(`- ID: ${f._id}, Name: ${f.name}, Email: ${f.email}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

checkFarmers();
