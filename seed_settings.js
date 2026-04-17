const mongoose = require('mongoose');
const adminSettingsModel = require('./models/adminSettingsModel');
require('dotenv').config();

const seed = async () => {
    try {
        await mongoose.connect(process.env.DB_URL || 'mongodb://localhost:27017/jeenora1');
        console.log('Connected to DB');

        const defaults = [
            {
                settingKey: 'menuDisplayMode',
                settingValue: { groups: [], defaultMode: 'grouped' },
                description: 'Default menu display settings'
            },
            {
                settingKey: 'wear_config',
                settingValue: { features: {}, active: true },
                description: 'General wear configuration'
            }
        ];

        for (const s of defaults) {
            await adminSettingsModel.findOneAndUpdate(
                { settingKey: s.settingKey },
                s,
                { upsert: true }
            );
            console.log(`Seeded: ${s.settingKey}`);
        }

        console.log('Done');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seed();
