const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function test() {
    try {
        console.log('Connecting to:', process.env.DB_URL);
        await mongoose.connect(process.env.DB_URL);
        console.log('Successfully connected to MongoDB');
        process.exit(0);
    } catch (err) {
        console.error('Connection error:', err);
        process.exit(1);
    }
}
test();
