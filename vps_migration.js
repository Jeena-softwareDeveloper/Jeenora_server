const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log("Loaded environment variables from local .env file");
} else {
    require('dotenv').config();
    console.log("No local .env file found, using system environment variables");
}

const dbUrl = process.env.DB_URL;
if (!dbUrl) {
    console.error("❌ Error: DB_URL environment variable is not defined!");
    console.log("Please define it in your environment or place a .env file with DB_URL in this folder.");
    process.exit(1);
}

// Define the Admin Schema inside the script so it is self-contained and doesn't rely on folder structure!
const adminSchema = new mongoose.Schema({
    name: String,
    email: String,
    role: String,
    permissions: [String],
    status: String
}, { timestamps: true });

const Admin = mongoose.model('admins', adminSchema);

async function migrate() {
    try {
        console.log(`🔌 Connecting to database...`);
        await mongoose.connect(dbUrl);
        console.log("✅ Connected successfully!");

        // 1. Migrate roles to 'manager'
        console.log("\n🔄 Step 1: Migrating roles to 'manager'...");
        
        // Update subadmins to managers
        const roleResult1 = await Admin.updateMany(
            { role: 'subadmin' },
            { $set: { role: 'manager' } }
        );

        // Update admin accounts that are not primary admins to managers
        const primaryEmails = ['jeenoraofficial@gmail.com', 'admin@example.com'];
        const roleResult2 = await Admin.updateMany(
            { 
                role: 'admin',
                email: { $nin: primaryEmails }
            },
            { $set: { role: 'manager' } }
        );
        
        console.log(`👉 Status: Updated ${roleResult1.modifiedCount} 'subadmin' accounts and ${roleResult2.modifiedCount} non-primary 'admin' accounts to 'manager' role.`);

        // 2. Migrate permissions from 'subadmins.manage' to 'managers.manage'
        console.log("\n🔄 Step 2: Migrating permissions from 'subadmins.manage' to 'managers.manage'...");
        
        // Find all admins that have 'subadmins.manage' permission
        const targetAdmins = await Admin.find({ permissions: 'subadmins.manage' });
        console.log(`👉 Found ${targetAdmins.length} accounts with legacy 'subadmins.manage' permission.`);

        let updatedCount = 0;
        for (let admin of targetAdmins) {
            // Remove 'subadmins.manage' and add 'managers.manage'
            admin.permissions = admin.permissions.filter(p => p !== 'subadmins.manage');
            if (!admin.permissions.includes('managers.manage')) {
                admin.permissions.push('managers.manage');
            }
            await admin.save();
            updatedCount++;
        }
        console.log(`✅ Status: Successfully updated permissions for ${updatedCount} accounts.`);

        // 3. Print the final verification list of all accounts in the database
        console.log("\n📊 Step 3: Verifying final database state...");
        const allAdmins = await Admin.find({}).lean();
        console.log("\n📋 Current Accounts List:");
        allAdmins.forEach(acc => {
            console.log(`👤 Name: ${acc.name || 'N/A'} | Email: ${acc.email} | Role: ${acc.role} | Status: ${acc.status || 'active'}`);
            console.log(`   Permissions (${acc.permissions ? acc.permissions.length : 0}): [${acc.permissions ? acc.permissions.join(', ') : ''}]`);
            console.log("-".repeat(80));
        });

        console.log("\n🎉 Migration completed successfully!");

    } catch (error) {
        console.error("❌ Migration failed with error:", error);
    } finally {
        await mongoose.disconnect();
        console.log("🔌 Disconnected from database.");
    }
}

migrate();
