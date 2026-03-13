const mongoose = require('mongoose');
const PlanSettings = require('../models/hire/planSettingodel');

const DB_URL = "mongodb+srv://nutrio:nutrio@cluster0.zvpz4lh.mongodb.net/test";

const activatePlans = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(DB_URL);
        console.log("Connected.");

        console.log("Fetching PlanSettings...");
        const settings = await PlanSettings.getSettings();

        console.log(`Current plansComingSoon status: ${settings.plansComingSoon}`);

        settings.plansComingSoon = false;
        await settings.save();

        console.log("Updated plansComingSoon to false.");
        console.log("Plans should now be visible on the frontend.");

        process.exit(0);
    } catch (error) {
        console.error("Error updating plans:", error);
        process.exit(1);
    }
};

activatePlans();
