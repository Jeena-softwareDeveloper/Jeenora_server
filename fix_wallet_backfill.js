/**
 * fix_wallet_backfill.js
 * ─────────────────────────────────────────────────────────────────
 * ONE-TIME FIX: Backfill partnerId for the 2 paid orders with null partnerId
 * and create the missing wallet entries for them.
 *
 * Run: node fix_wallet_backfill.js
 * ─────────────────────────────────────────────────────────────────
 */
const mongoose = require('mongoose');
require('dotenv').config();

const dbUrl = process.env.DB_URL;
if (!dbUrl) {
    console.error('❌ DB_URL not found in .env!');
    process.exit(1);
}

// ─── HARDCODED TARGET DATA (from check_orders.js output) ─────────
const SUPPLIER_ID = '69f7408ab701ed803bba334e'; // Jeenora Choice
const SUPPLIER_NAME = 'Jeenora Choice';

// The 2 paid auth orders with null partnerId
const ORDERS_TO_FIX = [
    { id: '69fed1894dcc6f2a77a23602', amount: 5.6, delivery: 'confirmed' },
    { id: '69ff634a6c1759b7616aaf59', amount: 5.6, delivery: 'shipped' }
];

async function run() {
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(dbUrl);
    console.log('✅ Connected!\n');

    const db = mongoose.connection.db;

    // ─── STEP 1: Verify supplier exists ───────────────────────────
    const supplier = await db.collection('suppliers').findOne({
        _id: new mongoose.Types.ObjectId(SUPPLIER_ID)
    });

    if (!supplier) {
        console.error(`❌ Supplier ${SUPPLIER_ID} not found! Aborting.`);
        await mongoose.disconnect();
        return;
    }
    console.log(`✅ Supplier confirmed: ${supplier.businessDetails?.shopName || SUPPLIER_NAME}\n`);

    // ─── STEP 2: Fix each order ────────────────────────────────────
    for (const order of ORDERS_TO_FIX) {
        console.log(`\n──────────────────────────────────────────`);
        console.log(`Processing AuthOrder: ${order.id}`);
        console.log(`  delivery: ${order.delivery} | amount: ₹${order.amount}`);

        const orderId = new mongoose.Types.ObjectId(order.id);
        const supplierId = new mongoose.Types.ObjectId(SUPPLIER_ID);

        // 2a. Check current state
        const existingOrder = await db.collection('authororders').findOne({ _id: orderId });
        if (!existingOrder) {
            console.log(`  ⚠️  Order not found in DB! Skipping.`);
            continue;
        }

        // 2b. Update partnerId if null
        if (!existingOrder.partnerId) {
            await db.collection('authororders').updateOne(
                { _id: orderId },
                { $set: { partnerId: supplierId } }
            );
            console.log(`  ✅ Set partnerId = ${SUPPLIER_ID}`);
        } else {
            console.log(`  ℹ️  partnerId already set: ${existingOrder.partnerId}`);
        }

        // 2c. Create wallet entry if missing
        const existingWallet = await db.collection('partnerwallets').findOne({
            partnerId: SUPPLIER_ID,
            $or: [
                // Check both string and ObjectId formats
                { amount: order.amount }
            ]
        });

        // More precise check - look for wallet entry tied to this orderId or same month/amount
        const month = (existingOrder.createdAt || new Date()).getMonth() + 1;
        const year = (existingOrder.createdAt || new Date()).getFullYear();

        // Check by month/year and partnerId (rough match since no orderId tracking in wallet)
        const walletEntry = await db.collection('partnerwallets').findOne({
            partnerId: SUPPLIER_ID,
            amount: order.amount,
            month: month.toString(),
            year: year.toString()
        });

        if (!walletEntry) {
            await db.collection('partnerwallets').insertOne({
                partnerId: SUPPLIER_ID,
                amount: order.amount,
                month: month.toString(),
                year: year.toString(),
                authOrderId: orderId.toString(), // track source
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log(`  ✅ Created wallet entry: ₹${order.amount} for ${month}/${year}`);
        } else {
            console.log(`  ℹ️  Wallet entry already exists for this amount/month`);
        }
    }

    // ─── STEP 3: Final verification ───────────────────────────────
    console.log(`\n\n══════════════════════════════════════════`);
    console.log(`📊 POST-FIX VERIFICATION`);
    console.log(`══════════════════════════════════════════`);

    const walletEntries = await db.collection('partnerwallets').find({
        partnerId: SUPPLIER_ID
    }).toArray();

    const walletTotal = walletEntries.reduce((sum, w) => sum + (w.amount || 0), 0);

    console.log(`\n  Supplier: ${SUPPLIER_NAME} (${SUPPLIER_ID})`);
    console.log(`  Wallet entries: ${walletEntries.length}`);
    walletEntries.forEach(w => {
        console.log(`    ₹${w.amount} | ${w.month}/${w.year}`);
    });
    console.log(`  ─────────────────────────────`);
    console.log(`  TOTAL WALLET BALANCE: ₹${walletTotal.toFixed(2)}`);

    // Check auth orders
    const authOrders = await db.collection('authororders').find({
        partnerId: new mongoose.Types.ObjectId(SUPPLIER_ID)
    }).toArray();
    console.log(`\n  Auth Orders with valid partnerId: ${authOrders.length}`);
    authOrders.forEach(ao => {
        console.log(`    ${ao._id} | delivery: ${ao.delivery_status} | ₹${ao.partnerAmount || ao.price}`);
    });

    const nullPartner = await db.collection('authororders').countDocuments({
        $or: [{ partnerId: null }, { partnerId: { $exists: false } }]
    });
    console.log(`\n  Remaining null-partnerId orders: ${nullPartner} (these are old test orders, ignore)`);

    await mongoose.disconnect();
    console.log('\n✅ Fix complete! Restart the Node.js server for settlement changes to take effect.\n');
}

run().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
