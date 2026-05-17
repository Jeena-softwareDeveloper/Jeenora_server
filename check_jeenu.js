const mongoose = require('mongoose');
require('dotenv').config();

const dbUrl = process.env.DB_URL || 'mongodb+srv://nutrio:nutrio@cluster0.zvpz4lh.mongodb.net/test';

async function run() {
    await mongoose.connect(dbUrl);
    const db = mongoose.connection.db;

    console.log("=== DIAGNOSTIC REPORT FOR EMAIL 'admin@gmail.com' ===");
    
    // Find in wearbuyers
    const wearBuyer = await db.collection('wearbuyers').findOne({ email: 'admin@gmail.com' });
    if (wearBuyer) {
        console.log(`Found in wearbuyers:\n  - ID: ${wearBuyer._id}\n  - Name: ${wearBuyer.name}\n  - Phone: ${wearBuyer.phone}`);
        const orders = await db.collection('customerorders').countDocuments({ customerId: wearBuyer._id });
        console.log(`  - WearBuyer orders count: ${orders}`);
    } else {
        console.log("Not found in wearbuyers collection.");
    }

    // Find in customers
    const customer = await db.collection('customers').findOne({ email: 'admin@gmail.com' });
    if (customer) {
        console.log(`Found in customers:\n  - ID: ${customer._id}\n  - Name: ${customer.name}\n  - Phone: ${customer.phone}`);
        const orders = await db.collection('customerorders').countDocuments({ customerId: customer._id });
        console.log(`  - Customer orders count: ${orders}`);
    } else {
        console.log("Not found in customers collection.");
    }

    // Search orders by email or phone in shippingInfo
    console.log("\nSearching for orders in customerorders by shippingInfo email/phone...");
    const ordersByPhone = await db.collection('customerorders').find({
        $or: [
            { "shippingInfo.email": "admin@gmail.com" },
            { "shippingInfo.phone": "1234567890" },
            { "shippingInfo.phone": "9344193599" }
        ]
    }).toArray();
    console.log(`Found ${ordersByPhone.length} orders by email/phone in shippingInfo.`);
    for (const ord of ordersByPhone) {
        console.log(`  - Order ID: ${ord._id} | customerId: ${ord.customerId} | Name: ${ord.shippingInfo?.name} | Phone: ${ord.shippingInfo?.phone}`);
    }

    await mongoose.disconnect();
}

run();
