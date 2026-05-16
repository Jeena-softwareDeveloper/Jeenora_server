const mongoose = require('mongoose');

module.exports.dbConnect = async () => {
    try {
        const dbUrl = process.env.DB_URL;
        console.log("Attempting to connect to DB...");
        // Log masked URL for debugging
        const maskedUrl = dbUrl ? dbUrl.replace(/\/\/.*@/, '//****:****@') : 'undefined';
        console.log(`Connecting to: ${maskedUrl}`);
        
        await mongoose.connect(dbUrl, { 
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log("✅ Database connected successfully")
    } catch (error) {
        console.error("❌ DB Connection Error:", error.message)
        process.exit(1)
    }
}

