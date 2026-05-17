const WearProduct = require('../../models/partner/WearProduct');
const Product = require('../../models/partner/Product');
const SupplierStock = require('../../models/partner/SupplierStock');
const AuthOrder = require('../../models/partner/AuthOrder');
const Partner = require('../../models/partner/Partner');
const Supplier = require('../../models/partner/Supplier');
const WearNotification = require('../../models/admin/WearNotification');
const moment = require('moment');

class InventoryAiService {
    /**
     * Calculates sales velocity for all active product variants 
     * and predicts the stockout date.
     * Operates on both WearProduct (live catalog) and SupplierStock (supplier inventory)
     */
    async updateStockoutPredictions() {
        console.log('[AI_INVENTORY] Starting daily stockout prediction update...');
        try {
            // ── Update WearProduct predictions ──
            const products = await WearProduct.find({ status: 'active' });
            const thirtyDaysAgo = moment().subtract(30, 'days').toDate();

            for (const product of products) {
                let updated = false;
                
                for (let i = 0; i < product.variants.length; i++) {
                    const variant = product.variants[i];
                    
                    const sales = await AuthOrder.aggregate([
                        {
                            $match: {
                                "products._id": product._id,
                                "products.size": variant.size,
                                createdAt: { $gte: thirtyDaysAgo },
                                delivery_status: { $ne: 'cancelled' }
                            }
                        },
                        { $unwind: "$products" },
                        {
                            $match: {
                                "products._id": product._id,
                                "products.size": variant.size
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalQty: { $sum: "$products.quantity" }
                            }
                        }
                    ]);

                    const totalSold = sales[0]?.totalQty || 0;
                    const velocity = totalSold / 30;

                    const availableStock = Math.max(0, (variant.stock || 0) - (variant.reservedStock || 0));
                    
                    if (velocity > 0 && availableStock > 0) {
                        const daysRemaining = Math.floor(availableStock / velocity);
                        product.variants[i].stockoutDate = moment().add(daysRemaining, 'days').toDate();
                        updated = true;
                    } else if (availableStock === 0) {
                        product.variants[i].stockoutDate = new Date();
                        updated = true;
                    } else {
                        product.variants[i].stockoutDate = null;
                    }
                }

                if (updated) {
                    await product.save();
                }
            }
            console.log('[AI_INVENTORY] WearProduct stockout predictions updated successfully.');
            
            // ── Update standard Product predictions ──
            const standardProducts = await Product.find({ status: 'active' });
            for (const product of standardProducts) {
                const sales = await AuthOrder.aggregate([
                    {
                        $match: {
                            "products._id": product._id,
                            createdAt: { $gte: thirtyDaysAgo },
                            delivery_status: { $ne: 'cancelled' }
                        }
                    },
                    { $unwind: "$products" },
                    {
                        $match: {
                            "products._id": product._id
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalQty: { $sum: "$products.quantity" }
                        }
                    }
                ]);

                const totalSold = sales[0]?.totalQty || 0;
                const velocity = totalSold / 30;
                const availableStock = Math.max(0, (product.stock || 0) - (product.reservedStock || 0));

                if (velocity > 0 && availableStock > 0) {
                    const daysRemaining = Math.floor(availableStock / velocity);
                    product.stockoutDate = moment().add(daysRemaining, 'days').toDate();
                    await product.save();
                } else if (availableStock === 0) {
                    product.stockoutDate = new Date();
                    await product.save();
                }
            }
            console.log('[AI_INVENTORY] Standard Product stockout predictions updated.');

            // ── Update SupplierStock predictions ──
            const supplierStocks = await SupplierStock.find({ status: { $ne: 'rejected' } });
            const ninetyDaysAgo = moment().subtract(90, 'days').toDate();
            let updatedCount = 0;

            for (const stock of supplierStocks) {
                let variantUpdated = false;
                
                for (let i = 0; i < stock.variants.length; i++) {
                    const variant = stock.variants[i];
                    
                    // Calculate sales velocity from orders linked to this supplier's product
                    const sales = await AuthOrder.aggregate([
                        {
                            $match: {
                                partnerId: stock.partnerId,
                                "products.styleCode": stock.styleCode,
                                "products.size": variant.size,
                                "products.color": variant.color,
                                createdAt: { $gte: thirtyDaysAgo },
                                delivery_status: { $ne: 'cancelled' }
                            }
                        },
                        { $unwind: "$products" },
                        {
                            $match: {
                                "products.styleCode": stock.styleCode,
                                "products.size": variant.size,
                                "products.color": variant.color
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalQty: { $sum: "$products.quantity" }
                            }
                        }
                    ]);

                    const totalSold = sales[0]?.totalQty || 0;
                    const velocity = totalSold / 30;
                    stock.variants[i].salesVelocity = velocity; // Save velocity
                    
                    const availableStock = Math.max(0, (variant.stock || 0) - (variant.reservedStock || 0));

                    if (velocity > 0 && availableStock > 0) {
                        const daysRemaining = Math.floor(availableStock / velocity);
                        const prediction = moment().add(daysRemaining, 'days').toDate();
                        stock.variants[i].stockoutDate = prediction;
                        stock.stockoutDate = prediction; // Use the most critical variant's date or similar logic
                        variantUpdated = true;
                    } else if (availableStock === 0) {
                        stock.variants[i].stockoutDate = new Date();
                        stock.stockoutDate = new Date();
                        variantUpdated = true;
                    } else {
                        // No sales data — keep existing prediction or clear
                    }
                }

                // Update lastMovementAt from recent orders
                const recentOrder = await AuthOrder.findOne({
                    partnerId: stock.partnerId,
                    "products.styleCode": stock.styleCode,
                    createdAt: { $gte: ninetyDaysAgo }
                }).sort({ createdAt: -1 });

                if (recentOrder) {
                    stock.lastMovementAt = recentOrder.createdAt;
                }

                if (variantUpdated) {
                    await stock.save();
                    updatedCount++;
                }
            }
            console.log(`[AI_INVENTORY] ${updatedCount} SupplierStock records updated with predictions.`);
        } catch (error) {
            console.error('[AI_INVENTORY_ERROR]', error.message);
        }
    }

    /**
     * Identifies "Dead Stock" — products with no sales/activity for 90+ days
     * Flags them on both WearProduct and SupplierStock
     */
    async identifyDeadStock() {
        console.log('[AI_INVENTORY] Starting dead stock identification...');
        try {
            const ninetyDaysAgo = moment().subtract(90, 'days').toDate();
            let deadStockCount = 0;

            // ── Check WearProduct ──
            const activeProducts = await WearProduct.find({ status: 'active' });
            for (const product of activeProducts) {
                const recentOrder = await AuthOrder.findOne({
                    "products._id": product._id,
                    createdAt: { $gte: ninetyDaysAgo },
                    delivery_status: { $ne: 'cancelled' }
                });

                if (!recentOrder) {
                    // No sales in 90 days — flag as dead stock
                    console.log(`[AI_INVENTORY] 🚩 Dead stock detected (WearProduct): ${product.productName} (${product._id})`);
                    // Add dead stock tag if not already
                    if (!product.tags.includes('dead_stock')) {
                        product.tags.push('dead_stock');
                        await product.save();
                    }
                    deadStockCount++;
                } else {
                    // Remove dead stock flag if exists
                    if (product.tags.includes('dead_stock')) {
                        product.tags = product.tags.filter(t => t !== 'dead_stock');
                        await product.save();
                    }
                }
            }

            // ── Check standard Product ──
            const standardActiveProducts = await Product.find({ status: 'active' });
            for (const product of standardActiveProducts) {
                const recentOrder = await AuthOrder.findOne({
                    "products._id": product._id,
                    createdAt: { $gte: ninetyDaysAgo },
                    delivery_status: { $ne: 'cancelled' }
                });

                if (!recentOrder && !product.isDeadStock) {
                    product.isDeadStock = true;
                    await product.save();
                    deadStockCount++;
                } else if (recentOrder && product.isDeadStock) {
                    product.isDeadStock = false;
                    await product.save();
                }
            }

            // ── Check SupplierStock ──
            const supplierStocks = await SupplierStock.find({ status: { $ne: 'rejected' } });
            for (const stock of supplierStocks) {
                const hasRecentActivity = !!stock.lastMovementAt && moment(stock.lastMovementAt).isAfter(ninetyDaysAgo);
                
                if (!hasRecentActivity) {
                    // Check orders too
                    const recentOrder = await AuthOrder.findOne({
                        partnerId: stock.partnerId,
                        "products.styleCode": stock.styleCode,
                        createdAt: { $gte: ninetyDaysAgo },
                        delivery_status: { $ne: 'cancelled' }
                    });

                    if (!recentOrder && !stock.isDeadStock) {
                        stock.isDeadStock = true;
                        if (!stock.aiTags.includes('dead_stock')) {
                            stock.aiTags.push('dead_stock');
                        }
                        await stock.save();
                        deadStockCount++;
                        console.log(`[AI_INVENTORY] 🚩 Dead stock detected (SupplierStock): ${stock.styleName} (${stock.styleCode})`);
                    }
                } else if (stock.isDeadStock) {
                    // Revival — remove dead stock flag
                    stock.isDeadStock = false;
                    stock.aiTags = stock.aiTags.filter(t => t !== 'dead_stock');
                    await stock.save();
                }
            }

            console.log(`[AI_INVENTORY] ✅ Dead stock identification complete. ${deadStockCount} items flagged.`);
            return deadStockCount;
        } catch (error) {
            console.error('[AI_INVENTORY_DEAD_STOCK_ERROR]', error.message);
            return 0;
        }
    }

    /**
     * Sends restock alerts to suppliers whose available stock is below reorderLevel
     * AND stock is predicted to run out within 5 days
     */
    async sendRestockAlerts() {
        console.log('[AI_INVENTORY] Starting restock alert scan...');
        try {
            const now = new Date();
            const fiveDaysFromNow = moment().add(5, 'days').toDate();
            let alertCount = 0;

            const stocks = await SupplierStock.find({ 
                status: 'active',
                $or: [
                    // Stockout predicted within 5 days
                    { stockoutDate: { $gte: now, $lte: fiveDaysFromNow } },
                    // Or available stock below reorder level
                    { 
                        $expr: {
                            $gt: [{ $size: { $filter: {
                                input: '$variants',
                                as: 'v',
                                cond: { $and: [
                                    { $gt: [{ $subtract: ['$$v.stock', { $ifNull: ['$$v.reservedStock', 0] }] }, 0] },
                                    { $lte: [{ $subtract: ['$$v.stock', { $ifNull: ['$$v.reservedStock', 0] }] }, '$reorderLevel'] }
                                ]}
                            }}}, 0]
                        }
                    }
                ],
                // Only if we haven't sent alert in last 3 days (avoid spam)
                $or: [
                    { restockAlertSentAt: null },
                    { restockAlertSentAt: { $lte: moment().subtract(3, 'days').toDate() } }
                ]
            });

            for (const stock of stocks) {
                // Find supplier's user ID for notifications
                const supplierDoc = await Supplier.findById(stock.partnerId);
                if (!supplierDoc || !supplierDoc.user) continue;

                // Build list of low-stock variants
                const lowVariants = stock.variants
                    .filter(v => (v.stock - (v.reservedStock || 0)) > 0 && (v.stock - (v.reservedStock || 0)) <= stock.reorderLevel)
                    .map(v => `${v.color}/${v.size}: ${Math.max(0, v.stock - (v.reservedStock || 0))} left`);

                const outVariants = stock.variants
                    .filter(v => (v.stock - (v.reservedStock || 0)) <= 0)
                    .map(v => `${v.color}/${v.size}: OUT OF STOCK`);

                const daysToStockout = stock.stockoutDate 
                    ? moment(stock.stockoutDate).diff(now, 'days') 
                    : null;

                let title = '🔔 Restock Alert';
                let message = '';

                if (daysToStockout !== null && daysToStockout <= 5 && daysToStockout >= 0) {
                    title = '🚨 RESTOCK NOW — AI Prediction';
                    message = `📊 AI predicts "${stock.styleName}" (${stock.styleCode}) will run out in ${daysToStockout} day(s)! Please restock now to avoid sales loss. `;
                } else {
                    message = `⚠️ "${stock.styleName}" (${stock.styleCode}) needs restock! `;
                }

                if (lowVariants.length > 0) {
                    message += `Low: ${lowVariants.join(', ')}. `;
                }
                if (outVariants.length > 0) {
                    message += `Out: ${outVariants.join(', ')}. `;
                }
                message += `Reorder level: ${stock.reorderLevel}`;

                // Create notification
                await WearNotification.create({
                    userId: supplierDoc.user,
                    title,
                    message,
                    type: 'inventory',
                    metadata: {
                        stockId: stock._id,
                        styleName: stock.styleName,
                        styleCode: stock.styleCode,
                        stockoutDate: stock.stockoutDate,
                        daysToStockout
                    }
                });

                // Track alert sent time
                stock.restockAlertSentAt = now;
                await stock.save();
                alertCount++;

                console.log(`[AI_INVENTORY] 📬 Restock alert sent for ${stock.styleName} (#${alertCount})`);
            }

            console.log(`[AI_INVENTORY] ✅ Restock alerts sent: ${alertCount}`);
            return alertCount;
        } catch (error) {
            console.error('[AI_INVENTORY_RESTOCK_ALERT_ERROR]', error.message);
            return 0;
        }
    }

    /**
     * Sends dead stock alerts — suggest discount/clearance
     */
    async sendDeadStockAlerts() {
        console.log('[AI_INVENTORY] Starting dead stock alert scan...');
        try {
            const now = new Date();
            const sevenDaysAgo = moment().subtract(7, 'days').toDate();
            let alertCount = 0;

            const deadStocks = await SupplierStock.find({
                isDeadStock: true,
                status: 'active',
                // Only if we haven't sent alert in last 7 days
                $or: [
                    { deadStockAlertSentAt: null },
                    { deadStockAlertSentAt: { $lte: sevenDaysAgo } }
                ]
            });

            for (const stock of deadStocks) {
                const supplierDoc = await Supplier.findById(stock.partnerId);
                if (!supplierDoc || !supplierDoc.user) continue;

                const totalValue = stock.variants.reduce((sum, v) => sum + (v.stock * v.costPrice), 0);
                const totalUnits = stock.variants.reduce((sum, v) => sum + v.stock, 0);
                const daysSinceMovement = stock.lastMovementAt 
                    ? moment(now).diff(stock.lastMovementAt, 'days') 
                    : 'N/A';

                await WearNotification.create({
                    userId: supplierDoc.user,
                    title: '📦 Dead Stock Alert',
                    message: `"${stock.styleName}" (${stock.styleCode}) hasn't sold in ${daysSinceMovement} days. ${totalUnits} units (₹${totalValue}) are stuck. Consider running a discount or clearance sale! 📉`,
                    type: 'inventory',
                    metadata: {
                        stockId: stock._id,
                        styleName: stock.styleName,
                        styleCode: stock.styleCode,
                        totalUnits,
                        totalValue,
                        daysSinceMovement,
                        isDeadStock: true
                    }
                });

                stock.deadStockAlertSentAt = now;
                await stock.save();
                alertCount++;

                console.log(`[AI_INVENTORY] 📬 Dead stock alert sent for ${stock.styleName} (${totalUnits} units, ₹${totalValue})`);
            }

            console.log(`[AI_INVENTORY] ✅ Dead stock alerts sent: ${alertCount}`);
            return alertCount;
        } catch (error) {
            console.error('[AI_INVENTORY_DEAD_ALERT_ERROR]', error.message);
            return 0;
        }
    }

    /**
     * Runs the full inventory AI pipeline
     */
    async runFullPipeline() {
        console.log('[AI_INVENTORY] 🚀 Running full inventory AI pipeline...');
        try {
            await this.updateStockoutPredictions();
            await this.identifyDeadStock();
            await this.sendRestockAlerts();
            await this.sendDeadStockAlerts();
            console.log('[AI_INVENTORY] ✅ Full pipeline complete.');
        } catch (error) {
            console.error('[AI_INVENTORY_PIPELINE_ERROR]', error.message);
        }
    }
}

module.exports = new InventoryAiService();