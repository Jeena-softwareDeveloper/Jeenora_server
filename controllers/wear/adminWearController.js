const customerModel = require("../../models/wear/customerModel");
const wearBuyerModel = require("../../models/wear/wearBuyerModel");      // actual Wear app user model
const wearSessionModel = require("../../models/wear/wearSessionModel");    // JWT session tracking
const wearProductModel = require("../../models/wear/wearProductModel");
const customerOrder = require("../../models/wear/customerOrder");
const authOrder = require("../../models/wear/authOrder");
const supplierModel = require("../../models/wear/supplierModel");
const wearBannerModel = require("../../models/wear/wearBannerModel");
const wearLogModel = require("../../models/wear/wearLogModel");
const wearAuditLogModel = require("../../models/wear/wearAuditLogModel");
const wearSearchHistoryModel = require("../../models/wear/wearSearchHistoryModel");
const adminSettingsModel = require("../../models/adminSettingsModel");
const { responseReturn } = require("../../utiles/response");
const { mongo: { ObjectId } } = require('mongoose');
const moment = require('moment');

class adminWearController {

    // --- A. REVENUE & FINANCIAL CONTROL ---
    get_financial_stats = async (req, res) => {
        try {
            const today = moment().startOf('day').toDate();
            const startOfWeek = moment().startOf('week').toDate();
            const startOfMonth = moment().startOf('month').toDate();

            const getStats = async (startDate) => {
                return await customerOrder.aggregate([
                    { $match: { createdAt: { $gte: startDate }, payment_status: 'paid' } },
                    {
                        $group: {
                            _id: null,
                            revenue: { $sum: '$price' },
                            commission: { $sum: '$totalCommission' },
                            count: { $sum: 1 }
                        }
                    }
                ]);
            };

            const [daily, weekly, monthly, total] = await Promise.all([
                getStats(today),
                getStats(startOfWeek),
                getStats(startOfMonth),
                getStats(new Date(0))
            ]);

            const refundStats = await authOrder.aggregate([
                { $match: { return_status: 'completed' } },
                { $group: { _id: null, totalRefunded: { $sum: '$price' }, count: { $sum: 1 } } }
            ]);

            // Vendor Payable
            const payableStats = await authOrder.aggregate([
                { $match: { payment_status: 'paid', delivery_status: { $ne: 'cancelled' } } },
                { $group: { _id: null, totalPayable: { $sum: '$sellerAmount' } } }
            ]);

            // Wallet Liability
            const walletStats = await customerModel.aggregate([
                { $group: { _id: null, totalBalance: { $sum: '$wallet.balance' } } }
            ]);

            // Revenue by Category
            const revByCategory = await customerOrder.aggregate([
                { $match: { payment_status: 'paid' } },
                { $unwind: '$products' },
                { $group: { _id: '$products.category', revenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } } } },
                { $sort: { revenue: -1 } }
            ]);

            // Revenue by Vendor
            const revByVendor = await authOrder.aggregate([
                { $match: { payment_status: 'paid' } },
                { $group: { _id: '$sellerId', revenue: { $sum: '$price' }, commission: { $sum: '$commissionAmount' } } },
                { $lookup: { from: 'suppliers', localField: '_id', foreignField: '_id', as: 'vendor' } },
                { $unwind: '$vendor' },
                { $project: { vendorName: '$vendor.businessName', revenue: 1, commission: 1 } },
                { $sort: { revenue: -1 } }
            ]);

            // Banner Revenue (Mock: Assume 500 per sponsored banner)
            const sponsoredBanners = await wearBannerModel.countDocuments({ sponsoredBy: { $ne: null } });
            const bannerRevenue = sponsoredBanners * 500;

            // Pending Settlements (Orders delivered but not yet within a 'settled' status if such existed, or simply sum of delivered)
            const pendingSettlements = await authOrder.aggregate([
                { $match: { delivery_status: 'delivered', payment_status: 'paid' } },
                { $group: { _id: null, total: { $sum: '$sellerAmount' } } }
            ]);

            responseReturn(res, 200, {
                revenue: {
                    daily: daily[0] || { revenue: 0, commission: 0, count: 0 },
                    weekly: weekly[0] || { revenue: 0, commission: 0, count: 0 },
                    monthly: monthly[0] || { revenue: 0, commission: 0, count: 0 },
                    total: total[0] || { revenue: 0, commission: 0, count: 0 },
                    byCategory: revByCategory,
                    byVendor: revByVendor,
                    bannerRevenue
                },
                refunds: refundStats[0] || { totalRefunded: 0, count: 0 },
                vendorPayable: payableStats[0]?.totalPayable || 0,
                walletLiability: walletStats[0]?.totalBalance || 0,
                pendingSettlements: pendingSettlements[0]?.total || 0
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // --- B. VENDOR MANAGEMENT ---
    update_vendor_commission = async (req, res) => {
        const { supplierId, commissionRate } = req.body;
        try {
            await supplierModel.findByIdAndUpdate(supplierId, { commissionRate });
            // Log action
            await wearAuditLogModel.create({
                adminId: req.id,
                action: 'VENDOR_COMMISSION_UPDATE',
                targetId: supplierId,
                targetModel: 'suppliers',
                changes: { newValue: commissionRate }
            });
            responseReturn(res, 200, { message: "Commission rate updated successfully" });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    update_vendor_status = async (req, res) => {
        const { supplierId } = req.params;
        const { status } = req.body; // approved, rejected, suspended
        try {
            await supplierModel.findByIdAndUpdate(supplierId, { status });
            // Log action
            await wearAuditLogModel.create({
                adminId: req.id,
                action: 'VENDOR_STATUS_UPDATE',
                targetId: supplierId,
                targetModel: 'suppliers',
                changes: { newValue: status }
            });
            responseReturn(res, 200, { message: `Vendor status updated to ${status}` });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_vendor_sales_report = async (req, res) => {
        const { supplierId } = req.params;
        try {
            const stats = await authOrder.aggregate([
                { $match: { sellerId: new ObjectId(supplierId), payment_status: 'paid' } },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$price' },
                        totalCommission: { $sum: '$commissionAmount' },
                        netEarnings: { $sum: '$sellerAmount' },
                        orderCount: { $sum: 1 }
                    }
                }
            ]);
            responseReturn(res, 200, { report: stats[0] || { totalRevenue: 0, orderCount: 0 } });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_vendor_rankings = async (req, res) => {
        try {
            const vendors = await authOrder.aggregate([
                {
                    $group: {
                        _id: '$sellerId',
                        totalSales: { $sum: '$price' },
                        orderCount: { $sum: 1 },
                        returnCount: {
                            $sum: { $cond: [{ $eq: ['$delivery_status', 'returned'] }, 1, 0] }
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'suppliers',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'details'
                    }
                },
                { $unwind: '$details' },
                {
                    $project: {
                        name: '$details.businessName',
                        totalSales: 1,
                        orderCount: 1,
                        returnRate: {
                            $multiply: [{ $divide: ['$returnCount', { $max: [1, '$orderCount'] }] }, 100]
                        }
                    }
                },
                { $sort: { totalSales: -1 } }
            ]);
            responseReturn(res, 200, { vendors });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // SLA Monitoring - Average time to ship/deliver
    get_sla_report = async (req, res) => {
        try {
            const sla = await authOrder.aggregate([
                { $match: { delivery_status: 'delivered' } },
                {
                    $project: {
                        sellerId: 1,
                        timeToDeliver: { $divide: [{ $subtract: ['$updatedAt', '$createdAt'] }, 1000 * 60 * 60] } // in hours
                    }
                },
                {
                    $group: {
                        _id: '$sellerId',
                        avgDeliveryTime: { $avg: '$timeToDeliver' }
                    }
                },
                {
                    $lookup: {
                        from: 'suppliers',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'vendor'
                    }
                },
                { $unwind: '$vendor' },
                { $project: { vendorName: '$vendor.businessName', avgDeliveryTime: 1 } }
            ]);
            responseReturn(res, 200, { sla });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // --- C. PRODUCT MODERATION ---
    toggle_product_status = async (req, res) => {
        const { productId } = req.params;
        const { status } = req.body; // active, inactive, rejected
        try {
            await wearProductModel.findByIdAndUpdate(productId, { status });
            await wearAuditLogModel.create({
                adminId: req.id,
                action: 'PRODUCT_STATUS_UPDATE',
                targetId: productId,
                targetModel: 'WearProduct',
                changes: { newValue: status }
            });
            responseReturn(res, 200, { message: `Product marked as ${status}` });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    moderate_product = async (req, res) => {
        const { productId } = req.params;
        try {
            await wearProductModel.findByIdAndUpdate(productId, { isModerated: true });
            responseReturn(res, 200, { message: "Product content moderated and verified" });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    feature_product = async (req, res) => {
        const { productId } = req.params;
        const { isFeatured, priority } = req.body;
        try {
            await wearProductModel.findByIdAndUpdate(productId, { isFeatured, featuredPriority: priority || 0 });
            responseReturn(res, 200, { message: isFeatured ? "Product featured" : "Feature removed" });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    remove_duplicate_products = async (req, res) => {
        try {
            // Logic to find products with same name and seller
            const duplicates = await wearProductModel.aggregate([
                { $group: { _id: { name: "$productName", seller: "$sellerId" }, count: { $sum: 1 }, ids: { $push: "$_id" } } },
                { $match: { count: { $gt: 1 } } }
            ]);

            let removedCount = 0;
            for (const group of duplicates) {
                const [keep, ...toRemove] = group.ids;
                await wearProductModel.deleteMany({ _id: { $in: toRemove } });
                removedCount += toRemove.length;
            }

            responseReturn(res, 200, { message: `Cleaned up ${removedCount} duplicate products` });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    bulk_category_update = async (req, res) => {
        const { productIds, newCategory } = req.body;
        try {
            await wearProductModel.updateMany(
                { _id: { $in: productIds.map(id => new ObjectId(id)) } },
                { category: newCategory }
            );
            responseReturn(res, 200, { message: `Updated category for ${productIds.length} products` });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // --- D. ANALYTICS ---
    get_advanced_analytics = async (req, res) => {
        try {
            // 1. Top Keywords
            const topKeywords = await wearSearchHistoryModel.aggregate([
                { $group: { _id: '$query', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]);

            // 2. Best Selling SKUs
            const bestSellers = await customerOrder.aggregate([
                { $unwind: '$products' },
                {
                    $group: {
                        _id: '$products._id',
                        name: { $first: '$products.productName' },
                        totalQty: { $sum: '$products.quantity' },
                        revenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } }
                    }
                },
                { $sort: { totalQty: -1 } },
                { $limit: 10 }
            ]);

            // 3. Conversion Funnel (Mocked logic from logs)
            const views = await wearLogModel.countDocuments({ action: 'PAGE_VIEW' });
            const addToCarts = await wearLogModel.countDocuments({ action: 'ADD_TO_CART' });
            const checkouts = await wearLogModel.countDocuments({ action: 'CHECKOUT_START' });
            const purchases = await customerOrder.countDocuments({ payment_status: 'paid' });

            // 4. Banner CTR
            const bannerStats = await wearBannerModel.aggregate([
                { $project: { title: 1, ctr: { $cond: [{ $eq: ['$analytics.views', 0] }, 0, { $multiply: [{ $divide: ['$analytics.clicks', '$analytics.views'] }, 100] }] } } },
                { $sort: { ctr: -1 } }
            ]);

            // 5. Slow Moving Products (No sales in last 30 days)
            const thirtyDaysAgo = moment().subtract(30, 'days').toDate();
            const slowMoving = await wearProductModel.aggregate([
                {
                    $lookup: {
                        from: 'customerOrders',
                        let: { pId: '$_id' },
                        pipeline: [
                            { $unwind: '$products' },
                            { $match: { $expr: { $eq: ['$products._id', '$$pId'] }, createdAt: { $gte: thirtyDaysAgo } } }
                        ],
                        as: 'recentSales'
                    }
                },
                { $match: { recentSales: { $size: 0 }, status: 'active' } },
                { $limit: 10 }
            ]);

            responseReturn(res, 200, {
                topKeywords,
                bestSellers,
                bannerStats,
                slowMoving,
                funnel: {
                    views,
                    cartRate: ((addToCarts / Math.max(1, views)) * 100).toFixed(2),
                    checkoutDropRate: (((checkouts - purchases) / Math.max(1, checkouts)) * 100).toFixed(2),
                    totalConversion: ((purchases / Math.max(1, views)) * 100).toFixed(2)
                }
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // --- E. FRAUD & RISK ---
    get_risk_report = async (req, res) => {
        try {
            // High return buyers (more than 3 returns)
            const suspiciousBuyers = await customerOrder.aggregate([
                { $match: { delivery_status: 'returned' } },
                { $group: { _id: '$customerId', returnCount: { $sum: 1 } } },
                { $match: { returnCount: { $gt: 3 } } },
                {
                    $lookup: {
                        from: 'customers',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'details'
                    }
                },
                { $unwind: '$details' },
                { $project: { name: '$details.name', phone: '$details.phone', returnCount: 1 } }
            ]);

            // COD abuse - Users with high cancel rate for COD
            const codAbusers = await customerOrder.aggregate([
                { $match: { 'shippingInfo.paymentMethod': 'COD' } },
                { $group: { _id: '$customerId', total: { $sum: 1 }, cancelled: { $sum: { $cond: [{ $eq: ['$delivery_status', 'cancelled'] }, 1, 0] } } } },
                { $match: { cancelled: { $gt: 2 } } }, // more than 2 cancellations
                { $project: { cancelRate: { $multiply: [{ $divide: ['$cancelled', { $max: [1, '$total'] }] }, 100] } } },
                { $match: { cancelRate: { $gt: 50 } } } // more than 50% cancel rate
            ]);

            responseReturn(res, 200, { suspiciousBuyers, codAbusers });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_suspicious_logins = async (req, res) => {
        try {
            // wearLogModel schema: { user: ObjectId, device: { ip, deviceId }, action, createdAt }
            const yesterday = moment().subtract(24, 'hours').toDate();
            const suspicious = await wearLogModel.aggregate([
                // Match LOGIN actions in last 24h
                { $match: { action: 'LOGIN', createdAt: { $gte: yesterday } } },
                // Group by user field (not userId), collect distinct IPs from device.ip
                { $group: { _id: '$user', ips: { $addToSet: '$device.ip' }, count: { $sum: 1 } } },
                // Only keep users with 3+ distinct IPs
                { $addFields: { ipCount: { $size: '$ips' } } },
                { $match: { ipCount: { $gt: 2 } } },
                // Lookup from wearbuyers (WearBuyer model collection name)
                { $lookup: { from: 'wearbuyers', localField: '_id', foreignField: '_id', as: 'user' } },
                { $unwind: { path: '$user', preserveNullAndEmpty: false } },
                { $project: { name: '$user.name', phone: '$user.phone', ipCount: 1, loginCount: '$count', ips: 1 } }
            ]);
            responseReturn(res, 200, { suspicious });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    force_logout_user = async (req, res) => {
        const { userId } = req.params;
        try {
            // Delete all sessions for this user from wearSessionModel
            const result = await wearSessionModel.deleteMany({ userId });
            responseReturn(res, 200, {
                message: `User sessions revoked (${result.deletedCount} sessions removed). User will be forced to logout.`
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // --- F. AUDIT LOGS ---
    get_audit_logs = async (req, res) => {
        try {
            const logs = await wearAuditLogModel.find({}).sort({ createdAt: -1 }).limit(50);
            responseReturn(res, 200, { logs });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // --- G. ORDER MANAGEMENT (Control Tower) ---
    get_order_details_admin = async (req, res) => {
        const { orderId } = req.params;
        try {
            const mainOrder = await customerOrder.findById(orderId);
            const subOrders = await authOrder.find({ orderId: new ObjectId(orderId) });
            responseReturn(res, 200, { mainOrder, subOrders });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    force_cancel_order = async (req, res) => {
        const { orderId } = req.params;
        const { reason } = req.body;
        try {
            const order = await customerOrder.findById(orderId);
            if (!order) return responseReturn(res, 404, { error: 'Order not found' });

            // Restore Stock
            for (const item of order.products) {
                if (item.variants || item.size) {
                    await wearProductModel.findOneAndUpdate(
                        { _id: item._id, "variants.size": item.size },
                        { $inc: { "variants.$.stock": item.quantity } }
                    );
                }
            }

            await customerOrder.findByIdAndUpdate(orderId, { delivery_status: 'cancelled' });
            await authOrder.updateMany({ orderId: new ObjectId(orderId) }, { delivery_status: 'cancelled' });

            await wearAuditLogModel.create({
                adminId: req.id,
                action: 'FORCE_CANCEL_ORDER',
                targetId: orderId,
                targetModel: 'customerOrders',
                changes: { reason }
            });

            responseReturn(res, 200, { message: "Order force cancelled and stock restored" });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    trigger_manual_refund = async (req, res) => {
        const { orderId } = req.params;
        try {
            const order = await customerOrder.findById(orderId);
            if (!order) return responseReturn(res, 404, { error: 'Order not found' });

            // Logic to interface with Stripe/Razorpay would go here
            // For now, we update status to 'returned' or 'refunded' if status existed
            await customerOrder.findByIdAndUpdate(orderId, { payment_status: 'refunded' });

            await wearAuditLogModel.create({
                adminId: req.id,
                action: 'MANUAL_REFUND_TRIGGERED',
                targetId: orderId,
                targetModel: 'customerOrders',
                changes: { amount: order.price }
            });

            responseReturn(res, 200, { message: "Refund process initiated successfully" });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // --- H. HOME LAYOUT CONTROL ---
    update_home_layout_config = async (req, res) => {
        const { activeSections } = req.body; // e.g., ["Banner", "Categories", "Flash Sale", "New Arrivals"]
        try {
            const config = await adminSettingsModel.findOneAndUpdate(
                { settingKey: 'wearHomeLayout' },
                { settingValue: activeSections, description: 'Active sections on Wear Home Screen' },
                { upsert: true, new: true }
            );
            responseReturn(res, 200, { message: "Home layout updated", config });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // --- I. ORDER LIST (Admin) — used by WearOrders dashboard ---
    get_all_orders_admin = async (req, res) => {
        const { page = 1, perPage = 10, search = '', status = '' } = req.query;
        const parPage = parseInt(perPage);
        const skip = (parseInt(page) - 1) * parPage;

        try {
            const query = {};
            if (status) query.delivery_status = status;
            if (search) query.$or = [
                { _id: { $regex: search, $options: 'i' } },
                { 'shippingInfo.name': { $regex: search, $options: 'i' } }
            ];

            const [orders, total] = await Promise.all([
                customerOrder.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parPage)
                    .lean(),
                customerOrder.countDocuments(query)
            ]);

            responseReturn(res, 200, { orders, total, totalOrder: total });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // --- J. COD CONTROL — disable COD for a specific user ---
    disable_cod_for_user = async (req, res) => {
        const { userId } = req.params;
        try {
            // wearBuyerModel is the actual Wear app customer model
            // Using $set with upsert-safe field — codDisabled is stored as a dynamic field (MongoDB allows this)
            await wearBuyerModel.findByIdAndUpdate(
                userId,
                { $set: { codDisabled: true } },
                { new: true }
            );

            await wearAuditLogModel.create({
                adminId: req.id,
                action: 'COD_DISABLED',
                targetId: userId,
                targetModel: 'wearbuyers',
                changes: { reason: 'High COD cancellation rate — admin action' }
            });

            responseReturn(res, 200, { message: 'COD has been disabled for this user' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // --- K. GLOBAL FORCE LOGOUT — revoke ALL active sessions ---
    global_force_logout = async (req, res) => {
        try {
            // wearSessionModel already imported at top of file
            const result = await wearSessionModel.deleteMany({});

            await wearAuditLogModel.create({
                adminId: req.id,
                action: 'GLOBAL_FORCE_LOGOUT',
                targetId: req.id,
                targetModel: 'sessions',
                changes: { sessionsRevoked: result.deletedCount }
            });

            responseReturn(res, 200, {
                message: `All ${result.deletedCount} active sessions terminated. All users are logged out.`
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new adminWearController();
