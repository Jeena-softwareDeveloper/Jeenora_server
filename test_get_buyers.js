const mongoose = require('mongoose');
require('dotenv').config();

const dbUrl = process.env.DB_URL || 'mongodb+srv://nutrio:nutrio@cluster0.zvpz4lh.mongodb.net/test';

// Import models
const wearBuyerModel = require("./models/customer/wearBuyerModel");
const supplierModel = require("./models/partner/Supplier");
const customerOrder = require("./models/customer/customerOrder");
const wearCartModel = require("./models/customer/wearCartModel");
const wearProductModel = require("./models/partner/WearProduct");
const authOrder = require("./models/partner/AuthOrder");

async function run() {
    await mongoose.connect(dbUrl);
    console.log("Connected to MongoDB for controller testing...");

    try {
        const query = {};
        const skipPage = 0;
        const perPage = 30;

        // Fetch supplier user IDs
        const suppliers = await supplierModel.find({}).lean();
        const supplierUserIds = suppliers.map(s => s.user ? s.user.toString() : null).filter(Boolean);

        const [buyers, total] = await Promise.all([
            wearBuyerModel.find(query)
                .sort({ createdAt: -1 })
                .skip(skipPage)
                .limit(parseInt(perPage))
                .lean(),
            wearBuyerModel.countDocuments(query)
        ]);

        console.log(`Fetched ${buyers.length} buyers. Total: ${total}`);

        // For each buyer, fetch their details depending on status
        const buyersWithRichStats = await Promise.all(buyers.map(async (buyer) => {
            const orderCount = await customerOrder.countDocuments({ customerId: buyer._id });
            const totalSpent = await customerOrder.aggregate([
                { $match: { customerId: buyer._id, payment_status: 'paid' } },
                { $group: { _id: null, total: { $sum: '$price' } } }
            ]);

            // Check if they are a supplier
            const supplierInfo = await supplierModel.findOne({ user: buyer._id }).lean();
            const isSupplier = !!supplierInfo;

            // Fetch cart items for this user (customer/supplier buyer mode)
            const cartItems = await wearCartModel.find({ userId: buyer._id })
                .populate({ path: 'productId', model: 'WearProduct', select: 'productName images price description' })
                .lean();

            // Fetch past orders list (customer/supplier buyer mode)
            const pastOrders = await customerOrder.find({ customerId: buyer._id })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean();

            let supplierStats = null;
            if (isSupplier) {
                // Fetch products and supplier order metrics
                const productCount = await wearProductModel.countDocuments({ partnerId: supplierInfo._id });
                const salesStats = await authOrder.aggregate([
                    { $match: { partnerId: supplierInfo._id, payment_status: 'paid' } },
                    { $group: { _id: null, totalSales: { $sum: '$price' }, netEarnings: { $sum: '$partnerAmount' }, count: { $sum: 1 } } }
                ]);

                supplierStats = {
                    productCount,
                    totalSales: salesStats[0]?.totalSales || 0,
                    netEarnings: salesStats[0]?.netEarnings || 0,
                    orderCount: salesStats[0]?.count || 0
                };
            }

            return {
                ...buyer,
                orderCount,
                totalSpent: totalSpent[0]?.total || 0,
                isSupplier,
                supplierDetails: supplierInfo,
                supplierStats,
                cartItems,
                orders: pastOrders
            };
        }));

        console.log("SUCCESS! Fully fetched buyers with rich statistics without any error!");
        console.log("Sample buyer rich stats populated fields:", Object.keys(buyersWithRichStats[0] || {}));
    } catch (err) {
        console.error("CRITICAL RUNTIME ERROR IN CONTROLLER LOGIC:", err);
    }

    await mongoose.disconnect();
}

run();
