const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const Guide = require('../models/Awareness/guideModel');

async function check() {
    await mongoose.connect(process.env.DB_URL);
    const slug = 'perennial-crop-integration';
    const guide = await Guide.findOne({ slug });
    if (guide) {
        console.log('isActive:', guide.isActive);
        console.log('slug:', guide.slug);
        console.log('heading:', guide.heading);
    } else {
        console.log('Not found');
    }
    process.exit(0);
}
check();
