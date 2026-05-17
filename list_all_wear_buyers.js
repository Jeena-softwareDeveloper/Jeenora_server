const mongoose = require('mongoose');
require('dotenv').config();

const dbUrl = process.env.DB_URL || 'mongodb+srv://nutrio:nutrio@cluster0.zvpz4lh.mongodb.net/test';

async function run() {
    await mongoose.connect(dbUrl);
    const db = mongoose.connection.db;

    const wearBuyers = await db.collection('wearbuyers').find({}).toArray();
    console.log("=== WEAR BUYERS SYSTEM AUDIT IN DATABASE ===");
    console.log(`Total Wear Buyers: ${wearBuyers.length}\n`);

    for (let idx = 0; idx < wearBuyers.length; idx++) {
        const buyer = wearBuyers[idx];
        const orders = await db.collection('customerorders').find({ customerId: buyer._id }).toArray();
        const carts = await db.collection('wearcarts').find({ userId: buyer._id }).toArray();
        const supplier = await db.collection('suppliers').findOne({ user: buyer._id });

        console.log(`${idx + 1}. Name: ${buyer.name} | Email: ${buyer.email} | ID: ${buyer._id}`);
        console.log(`   - Phone: ${buyer.phone} | City: ${buyer.city || 'N/A'}`);
        console.log(`   - Orders: ${orders.length} matches`);
        if (orders.length > 0) {
            console.log(`     Order IDs: ${orders.map(o => o._id.toString()).join(', ')}`);
        }
        console.log(`   - Carts: ${carts.length} matches`);
        if (carts.length > 0) {
            console.log(`     Cart IDs: ${carts.map(c => c._id.toString()).join(', ')}`);
        }
        console.log(`   - Supplier status: ${supplier ? 'Linked (' + supplier.businessDetails?.shopName + ', ' + supplier.status + ')' : 'NOT Linked'}`);
        console.log("--------------------------------------------------------------------------------");
    }

    await mongoose.disconnect();
}

run();
