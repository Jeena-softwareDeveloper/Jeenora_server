/**
 * check_orders.js — WALLET DIAGNOSIS v2
 * ─────────────────────────────────────────────────────────────────
 * Run: node check_orders.js
 * ─────────────────────────────────────────────────────────────────
 */
const mongoose = require('mongoose');
require('dotenv').config();

const dbUrl = process.env.DB_URL || 'mongodb+srv://nutrio:nutrio@cluster0.zvpz4lh.mongodb.net/test';

async function run() {
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(dbUrl);
    console.log('✅ Connected!\n');

    const db = mongoose.connection.db;

    // ─── 1. SUPPLIER PAYMENTS (partnerWallet entries) ──────────────
    console.log('═══════════════════════════════════════════════════════');
    console.log('💰 PARTNER WALLET ENTRIES (partnerwallets)');
    console.log('═══════════════════════════════════════════════════════');
    const walletEntries = await db.collection('partnerwallets').find({}).sort({ createdAt: -1 }).toArray();
    if (walletEntries.length === 0) {
        console.log('❌ NO WALLET ENTRIES! Wallet will show ₹0 on supplier dashboard.');
    } else {
        walletEntries.forEach(w => {
            console.log(`  partnerId: ${w.partnerId} | ₹${w.amount} | ${w.month}/${w.year}`);
        });
    }

    // ─── 2. PAID AUTH ORDERS WITH MISSING WALLET ─────────────────
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔍 PAID AUTH ORDERS WITH MISSING WALLET ENTRY');
    console.log('═══════════════════════════════════════════════════════');
    const paidAuthOrders = await db.collection('authororders')
        .find({ payment_status: 'paid' })
        .toArray();

    console.log(`Total paid auth orders: ${paidAuthOrders.length}`);
    for (const ao of paidAuthOrders) {
        const pid = ao.partnerId ? ao.partnerId.toString() : null;
        const walletEntry = pid ? await db.collection('partnerwallets').findOne({ partnerId: pid }) : null;

        console.log(`\n  AuthOrder: ${ao._id}`);
        console.log(`    partnerId: ${pid || '⚠️  NULL/UNDEFINED'}`);
        console.log(`    delivery: ${ao.delivery_status}`);
        console.log(`    amount: ₹${ao.partnerAmount || ao.price}`);
        console.log(`    wallet_entry: ${walletEntry ? '✅ EXISTS' : '❌ MISSING'}`);
    }

    // ─── 3. SHIPPED ORDERS (should now show in balance) ──────────
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🚚 AUTH ORDERS BY DELIVERY STATUS');
    console.log('═══════════════════════════════════════════════════════');
    const statusGroups = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    for (const status of statusGroups) {
        const count = await db.collection('authororders').countDocuments({ delivery_status: status });
        const icon = status === 'delivered' ? '✅' : status === 'shipped' ? '🚚' : status === 'cancelled' ? '❌' : '⏳';
        console.log(`  ${icon} ${status}: ${count}`);
    }

    // ─── 4. ORDERS WITH partnerId = null ─────────────────────────
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🚨 AUTH ORDERS WITH partnerId = null/undefined (legacy bug)');
    console.log('═══════════════════════════════════════════════════════');
    const nullPartnerOrders = await db.collection('authororders').find({
        $or: [{ partnerId: null }, { partnerId: { $exists: false } }]
    }).toArray();

    console.log(`Orders with null partnerId: ${nullPartnerOrders.length}`);

    if (nullPartnerOrders.length > 0) {
        console.log('\n  To fix these, we need to backfill partnerId from the product.');
        console.log('  Run the backfill script or fix manually:\n');

        // Attempt auto-backfill
        console.log('  Attempting auto-backfill from WearProduct collection...');
        let fixed = 0;
        let failed = 0;

        for (const ao of nullPartnerOrders) {
            // Try to find partnerId from the products array
            const products = ao.products || [];
            let partnerId = null;

            for (const p of products) {
                const productId = p._id || p.productId;
                if (!productId) continue;

                const wearProduct = await db.collection('wearproducts').findOne({ _id: productId });
                if (wearProduct && wearProduct.partnerId) {
                    partnerId = wearProduct.partnerId;
                    break;
                }
            }

            if (partnerId) {
                await db.collection('authororders').updateOne(
                    { _id: ao._id },
                    { $set: { partnerId } }
                );
                console.log(`  ✅ Fixed AuthOrder ${ao._id} → partnerId: ${partnerId}`);
                fixed++;
            } else {
                console.log(`  ⚠️  Could not fix AuthOrder ${ao._id} — product not found in wearproducts`);
                failed++;
            }
        }

        console.log(`\n  Backfill result: ${fixed} fixed, ${failed} failed`);
    }

    // ─── 5. SUPPLIERS & THEIR WALLET TOTALS ──────────────────────
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🏪 SUPPLIERS & WALLET BALANCES');
    console.log('═══════════════════════════════════════════════════════');
    const suppliers = await db.collection('suppliers').find({}).toArray();
    for (const s of suppliers) {
        const walletTotal = await db.collection('partnerwallets').aggregate([
            { $match: { partnerId: s._id.toString() } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]).toArray();

        const authOrderCount = await db.collection('authororders').countDocuments({
            partnerId: s._id
        });

        const total = walletTotal[0]?.total || 0;
        console.log(`\n  ${s.businessDetails?.shopName || 'N/A'} (_id: ${s._id})`);
        console.log(`    Auth orders: ${authOrderCount}`);
        console.log(`    Wallet total: ₹${total}`);
    }

    // ─── 6. SUMMARY ───────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    const totalOrders = await db.collection('customerorders').countDocuments({});
    const paid = await db.collection('customerorders').countDocuments({ payment_status: 'paid' });
    const shipped = await db.collection('authororders').countDocuments({ delivery_status: 'shipped' });
    const delivered = await db.collection('authororders').countDocuments({ delivery_status: 'delivered' });
    const walletCount = await db.collection('partnerwallets').countDocuments({});
    const nullPartnerCount = await db.collection('authororders').countDocuments({
        $or: [{ partnerId: null }, { partnerId: { $exists: false } }]
    });

    console.log(`  Total Customer Orders  : ${totalOrders}`);
    console.log(`  Paid Orders            : ${paid}`);
    console.log(`  Auth Orders Shipped    : ${shipped}`);
    console.log(`  Auth Orders Delivered  : ${delivered}`);
    console.log(`  Wallet Entries         : ${walletCount}`);
    console.log(`  Null partnerId orders  : ${nullPartnerCount}`);

    await mongoose.disconnect();
    console.log('\n✅ Done.\n');
}

run().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
