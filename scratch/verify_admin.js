const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const adminModel = require('../models/adminModel');
const dotenv = require('dotenv');

dotenv.config();

const verifyAdmin = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('Database connected...');

        const email = process.env.ADMIN_EMAIL || 'jeenoraofficial@gmail.com';
        const admin = await adminModel.findOne({ email }).select('+password');

        if (!admin) {
            console.log('Admin NOT found with email:', email);
            process.exit(0);
        }

        console.log('Admin found:', admin.email);
        const password = process.env.ADMIN_PASSWORD || 'Jeenora.12345';
        const match = await bcrypt.compare(password, admin.password);

        console.log('Password match test:', match ? '✅ SUCCESS' : '❌ FAILED');
        
        if (!match) {
            console.log('Password in DB:', admin.password);
            const newHash = await bcrypt.hash(password, 10);
            console.log('Expected Hash (newly generated):', newHash);
        }

        process.exit(0);
    } catch (error) {
        console.error('Error verifying admin:', error);
        process.exit(1);
    }
};

verifyAdmin();
