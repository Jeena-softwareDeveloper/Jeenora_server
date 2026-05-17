const mongoose = require('mongoose');
require('dotenv').config();

const dbUrl = process.env.DB_URL || 'mongodb+srv://nutrio:nutrio@cluster0.zvpz4lh.mongodb.net/test';
const adminModel = require("./models/superadmin/adminModel");

async function run() {
    await mongoose.connect(dbUrl);
    console.log("Connected to database...");
    
    // Find administrators
    const admins = await adminModel.find({}).lean();
    console.log("All Admins/Superadmins in database:");
    console.log(JSON.stringify(admins.map(a => ({
        _id: a._id,
        name: a.name,
        email: a.email,
        role: a.role,
        permissions: a.permissions
    })), null, 2));
    
    await mongoose.disconnect();
}

run();
