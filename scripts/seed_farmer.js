require('dotenv').config();
const mongoose = require('mongoose');
const Farmer = require('../models/Awareness/farmerModel');
const bcrypt = require('bcrypt');

const seedFarmer = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log("✅ Database connected.");

        // Check if test farmer exists
        const email = "farmer@example.com";
        const existing = await Farmer.findOne({ email });
        
        if (existing) {
            console.log("Test farmer already exists.");
        } else {
            const password = await bcrypt.hash("password123", 10);
            await Farmer.create({
                name: "Jeenora Farmer",
                email: email,
                password: password,
                district: "Coimbatore",
                crops: ["Rice", "Coconut"],
                role: "farmer"
            });
            console.log("✅ Test farmer created: farmer@example.com / password123");
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
};

seedFarmer();
