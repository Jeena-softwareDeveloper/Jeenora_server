const mongoose = require('mongoose');
require('dotenv').config();

const dbUrl = process.env.DB_URL || 'mongodb+srv://nutrio:nutrio@cluster0.zvpz4lh.mongodb.net/test';
const adminSettingsModel = require("./models/superadmin/adminSettingsModel");

async function run() {
    await mongoose.connect(dbUrl);
    console.log("Connected to database...");
    const settings = await adminSettingsModel.find({}).lean();
    console.log("All settings in database:");
    console.log(JSON.stringify(settings, null, 2));
    await mongoose.disconnect();
}

run();
