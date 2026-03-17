require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const adminModel = require('../models/adminModel');

async function seedAdmin() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.DB_URL);

        const adminName = process.env.ADMIN_NAME || 'Admin';
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            console.error('❌ Error: ADMIN_EMAIL and ADMIN_PASSWORD must be defined in .env file');
            process.exit(1);
        }

        const existingAdmin = await adminModel.findOne({ email: adminEmail });

        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const adminData = {
            name: adminName,
            email: adminEmail,
            password: hashedPassword,
            image: `https://ui-avatars.com/api/?name=${encodeURIComponent(adminName)}&background=059669&color=fff&size=200`,
            role: 'admin'
        };

        if (existingAdmin) {
            console.log(`Updating existing admin: ${adminEmail}...`);
            await adminModel.findByIdAndUpdate(existingAdmin._id, adminData);
            console.log('✅ Admin credentials updated successfully!');
        } else {
            console.log(`Creating new admin: ${adminEmail}...`);
            await adminModel.create(adminData);
            console.log('✅ Admin user created successfully!');
        }

        console.log('-----------------------------------');
        console.log(`Name: ${adminName}`);
        console.log(`Email: ${adminEmail}`);
        console.log('-----------------------------------');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
}

seedAdmin();
