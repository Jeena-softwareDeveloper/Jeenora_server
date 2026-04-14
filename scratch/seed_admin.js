const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const adminModel = require('../models/adminModel');
const dotenv = require('dotenv');

dotenv.config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('Database connected...');

        const email = process.env.ADMIN_EMAIL || 'admin@gmail.com';
        const existingAdmin = await adminModel.findOne({ email });

        if (existingAdmin) {
            console.log('Admin already exists with email:', email);
            process.exit(0);
        }

        const password = process.env.ADMIN_PASSWORD || 'admin123';
        const hashedPassword = await bcrypt.hash(password, 10);

        const admin = await adminModel.create({
            name: process.env.ADMIN_NAME || 'Jeenora Admin',
            email: email,
            password: hashedPassword,
            image: 'https://res.cloudinary.com/dxh6gsda4/image/upload/v1712140669/profile/admin.jpg',
            role: 'admin'
        });

        console.log('Admin created successfully:');
        console.log('Email:', admin.email);
        console.log('Password (plain):', password);
        process.exit(0);
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exit(1);
    }
};

seedAdmin();
