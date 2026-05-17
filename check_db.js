const mongoose = require('mongoose');
require('dotenv').config();

const dbUrl = process.env.DB_URL || 'mongodb+srv://nutrio:nutrio@cluster0.zvpz4lh.mongodb.net/test';

async function run() {
    console.log("Connecting to MongoDB:", dbUrl);
    await mongoose.connect(dbUrl);
    console.log("Connected successfully!");

    const db = mongoose.connection.db;

    // List collections
    const collections = await db.listCollections().toArray();
    console.log("\n--- COLLECTIONS IN DATABASE ---");
    collections.forEach(col => console.log(`- ${col.name}`));

    // Count WearBuyers
    const wearBuyersCount = await db.collection('wearbuyers').countDocuments({});
    console.log(`\nWearBuyers Total Count: ${wearBuyersCount}`);

    // Count Customers (B2C)
    const customersCount = await db.collection('customers').countDocuments({});
    console.log(`Customers (B2C) Total Count: ${customersCount}`);

    // Count customerOrders
    const ordersCount = await db.collection('customerorders').countDocuments({});
    console.log(`customerOrders Total Count: ${ordersCount}`);

    // Count wearCarts
    const cartsCount = await db.collection('wearcarts').countDocuments({});
    console.log(`wearCarts Total Count: ${cartsCount}`);

    // Count suppliers
    const suppliersCount = await db.collection('suppliers').countDocuments({});
    console.log(`Suppliers Total Count: ${suppliersCount}`);

    // Inspect some WearBuyers and check their orders
    const wearBuyers = await db.collection('wearbuyers').find({}).limit(5).toArray();
    console.log("\n--- SAMPLE WEAR BUYERS ---");
    for (const buyer of wearBuyers) {
        const oCount = await db.collection('customerorders').countDocuments({ customerId: buyer._id });
        const cCount = await db.collection('wearcarts').countDocuments({ userId: buyer._id });
        const sDoc = await db.collection('suppliers').findOne({ user: buyer._id });
        console.log(`Buyer: ${buyer.name} (${buyer.email}) | ID: ${buyer._id}`);
        console.log(`  - Orders count matching customerId: ${oCount}`);
        console.log(`  - Cart items count matching userId: ${cCount}`);
        console.log(`  - Supplier linked document found: ${sDoc ? 'YES (' + sDoc.businessDetails?.shopName + ')' : 'NO'}`);
    }

    // Inspect some orders and check their customerId
    console.log("\n--- SAMPLE ORDERS IN DB ---");
    const sampleOrders = await db.collection('customerorders').find({}).limit(5).toArray();
    for (const ord of sampleOrders) {
        console.log(`Order ID: ${ord._id} | customerId: ${ord.customerId} | Price: ${ord.price} | Status: ${ord.delivery_status}`);
        // Let's check which user collection this customerId matches
        const isWearBuyer = await db.collection('wearbuyers').findOne({ _id: ord.customerId });
        const isB2CCustomer = await db.collection('customers').findOne({ _id: ord.customerId });
        console.log(`  - Matches wearbuyers collection? ${isWearBuyer ? 'YES (' + isWearBuyer.name + ')' : 'NO'}`);
        console.log(`  - Matches customers collection? ${isB2CCustomer ? 'YES (' + isB2CCustomer.name + ')' : 'NO'}`);
    }

    // Inspect some carts and check their userId
    console.log("\n--- SAMPLE CARTS IN DB ---");
    const sampleCarts = await db.collection('wearcarts').find({}).limit(5).toArray();
    for (const cart of sampleCarts) {
        console.log(`Cart Item ID: ${cart._id} | userId: ${cart.userId} | productId: ${cart.productId} | price: ${cart.price}`);
        const isWearBuyer = await db.collection('wearbuyers').findOne({ _id: cart.userId });
        const isB2CCustomer = await db.collection('customers').findOne({ _id: cart.userId });
        console.log(`  - Matches wearbuyers collection? ${isWearBuyer ? 'YES (' + isWearBuyer.name + ')' : 'NO'}`);
        console.log(`  - Matches customers collection? ${isB2CCustomer ? 'YES (' + isB2CCustomer.name + ')' : 'NO'}`);
    }

    await mongoose.disconnect();
    console.log("\nDisconnected from DB.");
}

run().catch(err => {
    console.error("Error running diagnostics:", err);
    process.exit(1);
});
