const authOrderModel = require('../../models/wear/authOrder')
const customerOrder = require('../../models/wear/customerOrder')

const myShopWallet = require('../../models/wear/myShopWallet')
const sellerWallet = require('../../models/wear/sellerWallet')

const cardModel = require('../../models/wear/cardModel')
const moment = require("moment")
const { responseReturn } = require('../../utiles/response')
const { mongo: { ObjectId } } = require('mongoose')
const productModel = require('../../models/wear/productModel')
const wearProductModel = require('../../models/wear/wearProductModel')
const stripe = require('stripe')(process.env.STRIPE_KEY || 'sk_test_51Q5pOLF4md42MzNFfd346XC4Ei7UQAadIsfGlApQRmoY7LTNTKCrkzzrXV7LHegwEVhXjoGd4LnCkQI6dDvDiFAB00dT4MULfg')
const { ORDER_STATUS, isValidTransition } = require('../../utiles/orderValidators')
const customerModel = require('../../models/wear/customerModel')
const wearAuditLogModel = require('../../models/wear/wearAuditLogModel')
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = process.env.RAZORPAY_KEY_ID ? new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
}) : null;

class orderController {
    // Transition helper is now imported as isValidTransition

    paymentCheck = async (id) => {
        try {
            const order = await customerOrder.findById(id)
            if (order && order.payment_status === 'unpaid') {
                await customerOrder.findByIdAndUpdate(id, {
                    delivery_status: 'cancelled'
                })
                await authOrderModel.updateMany({
                    orderId: id
                }, {
                    delivery_status: 'cancelled'
                })

                // RETURN STOCK back to inventory
                for (const item of order.products) {
                    const isWear = !!item.variants || !!item.size; // Detection
                    if (isWear) {
                        await wearProductModel.findOneAndUpdate(
                            { _id: item._id, "variants.size": item.size },
                            { $inc: { "variants.$.stock": item.quantity } }
                        );
                    } else {
                        await productModel.findByIdAndUpdate(
                            item._id,
                            { $inc: { stock: item.quantity } }
                        );
                    }
                }
            }
            return true
        } catch (error) {
            console.log(error)
        }
    }
    // end method 
    place_order = async (req, res) => {
        const { price, products, shipping_fee, shippingInfo, userId } = req.body
        let authorOrderData = []
        let cardId = []
        const tempDate = moment(Date.now()).format('LLL')

        let customerOrderProduct = []

        for (let i = 0; i < products.length; i++) {
            const pro = products[i].products
            for (let j = 0; j < pro.length; j++) {
                const tempCusPro = pro[j].productInfo;
                tempCusPro.quantity = pro[j].quantity
                customerOrderProduct.push(tempCusPro)
                if (pro[j]._id) {
                    cardId.push(pro[j]._id)
                }
            }
        }

        try {
            // --- ATOMIC STOCK LOCKING PHASE ---
            // Before creating any order records, we must ensure all items have sufficient stock
            // and reduce it atomically.
            for (let i = 0; i < products.length; i++) {
                const pro = products[i].products;
                for (let j = 0; j < pro.length; j++) {
                    const item = pro[j];
                    const productInfo = item.productInfo;
                    const requestedQty = item.quantity;
                    const isWear = !!productInfo.variants; // Detection logic for Wear vs Standard

                    let stockResult;
                    if (isWear) {
                        // Atomic check + decrease for Wear variant
                        stockResult = await wearProductModel.findOneAndUpdate(
                            {
                                _id: productInfo._id,
                                "variants.size": item.size || productInfo.variants[0].size,
                                "variants.stock": { $gte: requestedQty }
                            },
                            { $inc: { "variants.$.stock": -requestedQty } },
                            { new: true }
                        );
                    } else {
                        // Atomic check + decrease for standard product
                        stockResult = await productModel.findOneAndUpdate(
                            {
                                _id: productInfo._id,
                                stock: { $gte: requestedQty }
                            },
                            { $inc: { stock: -requestedQty } },
                            { new: true }
                        );
                    }

                    if (!stockResult) {
                        return responseReturn(res, 400, {
                            error: `Insufficient stock for ${productInfo.name || productInfo.productName}. Please adjust quantity.`
                        });
                    }
                }
            }

            const COMMISSION_RATE = 10; // Flat 10% commission for MVP
            let totalCommission = 0;

            for (let i = 0; i < products.length; i++) {
                const pro = products[i].products;
                const pri = products[i].price; // This is the subtotal for this seller
                const sellerId = products[i].sellerId;

                const commAmount = Math.round(pri * (COMMISSION_RATE / 100));
                const sellAmount = pri - commAmount;
                totalCommission += commAmount;

                let storePor = [];
                for (let j = 0; j < pro.length; j++) {
                    const tempPro = pro[j].productInfo;
                    tempPro.quantity = pro[j].quantity;
                    storePor.push(tempPro);
                }

                authorOrderData.push({
                    orderId: null, // Will be set after order.id is available, or use order._id if created first
                    sellerId,
                    products: storePor,
                    price: pri,
                    payment_status: 'unpaid',
                    shippingInfo: 'Easy Main Warehouse',
                    delivery_status: 'pending',
                    date: tempDate,
                    commissionRate: COMMISSION_RATE,
                    commissionAmount: commAmount,
                    sellerAmount: sellAmount
                });
            }

            const order = await customerOrder.create({
                customerId: userId,
                shippingInfo,
                products: customerOrderProduct,
                price: price + shipping_fee,
                payment_status: 'unpaid',
                delivery_status: 'pending',
                date: tempDate,
                totalCommission: totalCommission
            });

            // Update orderId for suborders
            authorOrderData = authorOrderData.map(o => ({ ...o, orderId: order.id }));

            await authOrderModel.insertMany(authorOrderData);
            for (let k = 0; k < cardId.length; k++) {
                await cardModel.findByIdAndDelete(cardId[k])
            }
            responseReturn(res, 200, { message: "Order Placed Success", orderId: order.id })

        } catch (error) {

            console.log(error.message)
        }

    }

    // --- MULTI-VENDOR STATUS SYNC HELPER ---
    sync_main_order_status = async (mainOrderId) => {
        try {
            const subOrders = await authOrderModel.find({ orderId: new ObjectId(mainOrderId) });
            if (subOrders.length === 0) return;

            const allDelivered = subOrders.every(o => o.delivery_status === 'delivered');
            const allCancelled = subOrders.every(o => o.delivery_status === 'cancelled');

            if (allDelivered) {
                await customerOrder.findByIdAndUpdate(mainOrderId, { delivery_status: 'delivered' });
            } else if (allCancelled) {
                await customerOrder.findByIdAndUpdate(mainOrderId, { delivery_status: 'cancelled' });
            }
        } catch (err) {
            console.log('Sync Logic Error:', err.message);
        }
    }

    // End Method

    // Centralized Scrubber for Customer Orders (Client-Facing)
    scrubCustomerOrder = (o) => ({
        _id: o._id,
        products: o.products,
        price: o.price,
        payment_status: o.payment_status,
        delivery_status: o.delivery_status,
        date: o.date,
        shippingInfo: o.shippingInfo || 'Standard Delivery'
        // totalCommission is EXCLUDED
    });

    get_customer_dashboard_data = async (req, res) => {
        const { userId } = req.params
        try {
            const recentOrdersRaw = await customerOrder.find({
                customerId: new ObjectId(userId)
            }).sort({ createdAt: -1 }).limit(5).lean();

            const pendingOrder = await customerOrder.find({
                customerId: new ObjectId(userId), delivery_status: 'pending'
            }).countDocuments()
            const totalOrder = await customerOrder.find({
                customerId: new ObjectId(userId)
            }).countDocuments()
            const cancelledOrder = await customerOrder.find({
                customerId: new ObjectId(userId), delivery_status: 'cancelled'
            }).countDocuments()

            responseReturn(res, 200, {
                recentOrders: recentOrdersRaw.map(this.scrubCustomerOrder),
                pendingOrder,
                totalOrder,
                cancelledOrder
            })

        } catch (error) {
            console.log(error.message)
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }
    // End Method

    get_orders = async (req, res) => {
        const { customerId, status } = req.params

        try {
            let ordersRaw = []
            if (status !== 'all') {
                ordersRaw = await customerOrder.find({
                    customerId: new ObjectId(customerId),
                    delivery_status: status
                }).sort({ createdAt: -1 }).lean();
            }
            else {
                ordersRaw = await customerOrder.find({
                    customerId: new ObjectId(customerId)
                }).sort({ createdAt: -1 }).lean();
            }
            responseReturn(res, 200, { orders: ordersRaw.map(this.scrubCustomerOrder) })
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }
    // End Method 

    get_order_details = async (req, res) => {
        const { orderId } = req.params
        try {
            const order = await customerOrder.aggregate([
                {
                    $match: { _id: new ObjectId(orderId) }
                },
                {
                    $lookup: {
                        from: 'authororders',
                        localField: "_id",
                        foreignField: 'orderId',
                        as: 'suborders'
                    }
                }
            ]);
            // Scrub suborders to remove internal platform fee info for customers
            if (order[0] && order[0].suborders) {
                order[0].suborders = order[0].suborders.map(so => ({
                    _id: so._id,
                    sellerId: so.sellerId,
                    products: so.products,
                    price: so.price,
                    delivery_status: so.delivery_status,
                    date: so.date
                    // commissionAmount and sellerAmount are EXCLUDED here
                }));
            }

            // Scrub main order top-level fields
            const mainOrder = this.scrubCustomerOrder(order[0]);

            responseReturn(res, 200, {
                order: {
                    ...mainOrder,
                    suborders: order[0].suborders || []
                }
            })
        } catch (error) {
            console.log(error.message)
        }
    }
    // End Method 

    get_admin_orders = async (req, res) => {
        let { page, searchValue, parPage } = req.query
        page = parseInt(page)
        parPage = parseInt(parPage)
        const skipPage = parPage * (page - 1)
        try {
            if (searchValue) {

            } else {
                const orders = await customerOrder.aggregate([
                    {
                        $lookup: {
                            from: 'authororders',
                            localField: "_id",
                            foreignField: 'orderId',
                            as: 'suborder'
                        }
                    }
                ]).skip(skipPage).limit(parPage).sort({ createdAt: -1 })
                const totalOrder = await customerOrder.aggregate([
                    {
                        $lookup: {
                            from: 'authororders',
                            localField: "_id",
                            foreignField: 'orderId',
                            as: 'suborder'
                        }
                    }
                ])
                responseReturn(res, 200, { orders, totalOrder: totalOrder.length })
            }
        } catch (error) {
            console.log(error.message)
        }
    }
    // End Method 
    get_admin_order = async (req, res) => {
        const { orderId } = req.params
        try {
            const order = await customerOrder.aggregate([
                {
                    $match: { _id: new ObjectId(orderId) }
                },
                {
                    $lookup: {
                        from: 'authororders',
                        localField: "_id",
                        foreignField: 'orderId',
                        as: 'suborder'
                    }
                }
            ])
            responseReturn(res, 200, { order: order[0] })
        } catch (error) {
            console.log('get admin order details' + error.message)
        }
    }
    // End Method 
    admin_order_status_update = async (req, res) => {
        const { orderId } = req.params
        const { status } = req.body
        try {
            const order = await customerOrder.findById(orderId)

            // 1. Validate Transition
            if (order && !isValidTransition(order.delivery_status, status)) {
                return responseReturn(res, 400, {
                    message: `Illegal Status Transition: Cannot move from ${order.delivery_status.toUpperCase()} to ${status.toUpperCase()}`
                })
            }

            // If transition to cancelled, return stock
            if (status === 'cancelled' && order.delivery_status !== 'cancelled') {
                for (const item of order.products) {
                    const isWear = !!item.variants || !!item.size;
                    if (isWear) {
                        await wearProductModel.findOneAndUpdate(
                            { _id: item._id, "variants.size": item.size },
                            { $inc: { "variants.$.stock": item.quantity } }
                        );
                    } else {
                        await productModel.findByIdAndUpdate(
                            item._id,
                            { $inc: { stock: item.quantity } }
                        );
                    }
                }
            }

            await customerOrder.findByIdAndUpdate(orderId, {
                delivery_status: status
            })
            await authOrderModel.updateMany({ orderId: new ObjectId(orderId) }, {
                delivery_status: status
            })

            // AUDIT LOG
            await wearAuditLogModel.create({
                adminId: req.id,
                action: 'ORDER_STATUS_UPDATE',
                targetId: orderId,
                targetModel: 'customerOrders',
                changes: { oldValue: order.delivery_status, newValue: status }
            });

            responseReturn(res, 200, { message: 'order Status change success' })
        } catch (error) {
            console.log('admin order status update error: ' + error.message)
            responseReturn(res, 500, { message: 'internal server error' })
        }

    }
    // End Method 
    get_seller_orders = async (req, res) => {
        const { sellerId } = req.params
        let { page, searchValue, parPage } = req.query
        page = parseInt(page)
        parPage = parseInt(parPage)
        const skipPage = parPage * (page - 1)
        try {
            if (searchValue) {

            } else {
                const orders = await authOrderModel.find({
                    sellerId,
                }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })
                const totalOrder = await authOrderModel.find({
                    sellerId
                }).countDocuments()
                responseReturn(res, 200, { orders, totalOrder })
            }

        } catch (error) {
            console.log('get seller Order error' + error.message)
            responseReturn(res, 500, { message: 'internal server error' })
        }
    }
    // End Method 
    get_seller_order = async (req, res) => {
        const { orderId } = req.params

        try {
            const order = await authOrderModel.findById(orderId)
            if (!order) return responseReturn(res, 404, { error: 'Order not found' });
            
            // Scrub order for seller: They don't need system-wide totals, just their portion
            const scrubbedOrder = {
                _id: order._id,
                orderId: order.orderId,
                products: order.products,
                price: order.price,
                delivery_status: order.delivery_status,
                payment_status: order.payment_status,
                date: order.date,
                sellerAmount: order.sellerAmount
            };

            responseReturn(res, 200, { order: scrubbedOrder })
        } catch (error) {
            console.log('get seller details error' + error.message)
        }
    }
    // End Method 
    seller_order_status_update = async (req, res) => {
        const { orderId } = req.params
        const { status } = req.body
        try {
            const order = await authOrderModel.findById(orderId)
            if (!order) return responseReturn(res, 404, { message: 'Order not found' })

            // 1. Validate Transition
            if (!isValidTransition(order.delivery_status, status)) {
                return responseReturn(res, 400, {
                    message: `Illegal Status Transition: Cannot move from ${order.delivery_status.toUpperCase()} to ${status.toUpperCase()}`
                })
            }

            await authOrderModel.findByIdAndUpdate(orderId, {
                delivery_status: status
            })

            // SYNC UPWARDS TO MAIN ORDER
            await this.sync_main_order_status(order.orderId);

            responseReturn(res, 200, { message: 'order status updated successfully' })
        } catch (error) {
            console.log('seller order status update error: ' + error.message)
            responseReturn(res, 500, { message: 'internal server error' })
        }
    }
    // End Method 

    create_payment = async (req, res) => {
        const { price } = req.body
        try {
            const amount = Math.round(price * 100 * 0.33);
            const payment = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                automatic_payment_methods: {
                    enabled: true
                }
            })
            responseReturn(res, 200, { clientSecret: payment.client_secret })
        } catch (error) {
            console.log(error.message)
        }
    }

    //END METHOD
    order_confirm = async (req, res) => {
        const { orderId } = req.params
        try {
            await customerOrder.findByIdAndUpdate(orderId, { payment_status: 'paid' })
            await authOrderModel.updateMany({ orderId: new ObjectId(orderId) }, {
                payment_status: 'paid', delivery_status: 'pending'
            })
            const cuOrder = await customerOrder.findById(orderId)
            const auOrder = await authOrderModel.find({
                orderId: new ObjectId(orderId)
            })
            const time = moment(Date.now()).format('l')
            const splitTime = time.split('/')

            // Settlement based on stored Snapshots (No recalculation)
            await myShopWallet.create({
                amount: cuOrder.totalCommission || 0, // Store only platform commission
                month: splitTime[0],
                year: splitTime[2]
            })

            for (let i = 0; i < auOrder.length; i++) {
                await sellerWallet.create({
                    sellerId: auOrder[i].sellerId.toString(),
                    amount: auOrder[i].sellerAmount || auOrder[i].price, // Use stored Net or fallback to Full
                    month: splitTime[0],
                    year: splitTime[2]
                })
            }
            responseReturn(res, 200, { message: 'success' })


        } catch (error) {
            console.log(error.message)
        }

    }
    // End Method 

    create_razorpay_order = async (req, res) => {
        const { orderId } = req.body;
        try {
            const order = await customerOrder.findById(orderId);
            if (!order) {
                return responseReturn(res, 404, { message: 'Order not found' });
            }

            const options = {
                amount: Math.round(order.price * 100), // amount in the smallest currency unit
                currency: "INR",
                receipt: `receipt_order_${order._id}`,
            };

            if (!razorpay) {
                return responseReturn(res, 500, { message: 'Razorpay is not configured on the server' });
            }

            const razorOrder = await razorpay.orders.create(options);
            responseReturn(res, 200, { razorOrder });

        } catch (error) {
            console.log(error.message);
            responseReturn(res, 500, { message: 'Razorpay order creation failed' });
        }
    }

    verify_razorpay_payment = async (req, res) => {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

        try {
            // 1. SIGNATURE VERIFICATION (STRICT MODE)
            const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
            shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
            const digest = shasum.digest('hex');

            if (digest !== razorpay_signature) {
                return responseReturn(res, 400, { message: 'Security Alert: Payment signature mismatch!' });
            }

            // 2. IDEMPOTENCY CHECK (Prevent duplicate verification)
            const order = await customerOrder.findById(orderId);
            if (!order) return responseReturn(res, 404, { message: 'Order not found' });
            if (order.payment_status === 'paid') {
                return responseReturn(res, 200, { message: 'Payment already verified' });
            }

            // 3. UPDATE ORDER STATUS -> PAYMENT SUCCESS
            await customerOrder.findByIdAndUpdate(orderId, {
                payment_status: 'paid',
                delivery_status: 'confirmed', // Move to confirmed after payment
                payment_id: razorpay_payment_id
            });

            await authOrderModel.updateMany({ orderId: new ObjectId(orderId) }, {
                payment_status: 'paid',
                delivery_status: 'confirmed'
            });

            // 4. SETTLE WALLETS BASED ON SNAPSHOTS
            const time = moment(Date.now()).format('l');
            const splitTime = time.split('/');

            await myShopWallet.create({
                amount: order.totalCommission || 0, // Snapshot from creation
                month: splitTime[0],
                year: splitTime[2]
            });

            const auOrders = await authOrderModel.find({ orderId: new ObjectId(orderId) });
            for (const auOrder of auOrders) {
                await sellerWallet.create({
                    sellerId: auOrder.sellerId.toString(),
                    amount: auOrder.sellerAmount || auOrder.price, // Snapshot from creation
                    month: splitTime[0],
                    year: splitTime[2]
                });
            }

            responseReturn(res, 200, { message: 'Payment verified successfully!' });

        } catch (error) {
            console.log(error.message);
            responseReturn(res, 500, { message: 'Internal server error during verification' });
        }
    }

    // ATOMIC STOCK LOCKING (NO OVERSELLING GUARANTEE)
    decrease_stock = async (req, res) => {
        const { productId } = req.params;
        const { quantity, size, isWearProduct } = req.body; // size and isWearProduct are optional

        try {
            let result;

            if (isWearProduct) {
                // If it's a Wear product with variants, we must decrease stock for that specific size
                // We use findOneAndUpdate with a query that ONLY matches if stock is >= quantity
                result = await wearProductModel.findOneAndUpdate(
                    {
                        _id: productId,
                        "variants.size": size,
                        "variants.stock": { $gte: quantity }
                    },
                    {
                        $inc: { "variants.$.stock": -quantity }
                    },
                    { new: true }
                );
            } else {
                // For standard products
                result = await productModel.findOneAndUpdate(
                    {
                        _id: productId,
                        stock: { $gte: quantity }
                    },
                    {
                        $inc: { stock: -quantity }
                    },
                    { new: true }
                );
            }

            if (!result) {
                // If result is null, either the product wasn't found or stock was insufficient
                return res.status(400).json({
                    success: false,
                    message: "Stock lock failed: Product not found or insufficient stock available."
                });
            }

            res.status(200).json({
                success: true,
                message: 'Stock booked successfully (Atomic Lock)',
                currentStock: isWearProduct ? result.variants.find(v => v.size === size).stock : result.stock
            });
        } catch (error) {
            console.error('[STOCK_LOCK_ERROR]', error);
            res.status(500).json({ success: false, message: 'Server error during atomic stock locking' });
        }
    }

    // END METHOD
    // ATOMIC STOCK RELEASE (RECOVERY)
    increase_stock = async (req, res) => {
        const { productId } = req.params;
        const { quantity, size, isWearProduct } = req.body;

        try {
            let result;

            if (isWearProduct) {
                result = await wearProductModel.findByIdAndUpdate(
                    productId,
                    { $inc: { "variants.$[elem].stock": quantity } },
                    {
                        arrayFilters: [{ "elem.size": size }],
                        new: true
                    }
                );
            } else {
                result = await productModel.findByIdAndUpdate(
                    productId,
                    { $inc: { stock: quantity } },
                    { new: true }
                );
            }

            if (!result) {
                return res.status(404).json({ success: false, message: "Product not found" });
            }

            res.status(200).json({
                success: true,
                message: 'Stock increased successfully',
                currentStock: isWearProduct ? result.variants.find(v => v.size === size).stock : result.stock
            });
        } catch (error) {
            console.error('[STOCK_INCREASE_ERROR]', error);
            res.status(500).json({ success: false, message: 'Server error during stock increase' });
        }
    }

    // END METHOD




    customer_order_cancel = async (req, res) => {
        const { orderId } = req.params;
        try {
            const order = await customerOrder.findById(orderId);
            if (!order) return responseReturn(res, 404, { message: 'Order not found' });

            // 1. Check if cancellation is allowed
            if (!['pending', 'confirmed'].includes(order.delivery_status)) {
                return responseReturn(res, 400, { message: 'Order cannot be cancelled at this stage' });
            }

            // 2. Return Stock
            for (const item of order.products) {
                const isWear = !!item.variants || !!item.size;
                if (isWear) {
                    await wearProductModel.findOneAndUpdate(
                        { _id: item._id, "variants.size": item.size },
                        { $inc: { "variants.$.stock": item.quantity } }
                    );
                } else {
                    await productModel.findByIdAndUpdate(
                        item._id,
                        { $inc: { stock: item.quantity } }
                    );
                }
            }

            // 3. REVERSE WALLET CREDITS / CASHBACK (Deduct on refund logic)
            // If the user earned any cashback from this order, we reverse it
            const customer = await customerModel.findById(order.customerId);
            if (customer && customer.wallet) {
                const earnedCredit = order.price * 0.05; // Assuming 5% cashback for MVP
                customer.wallet.balance = Math.max(0, customer.wallet.balance - earnedCredit);
                customer.wallet.cashback = Math.max(0, customer.wallet.cashback - earnedCredit);
                customer.wallet.transactions.push({
                    type: 'debit',
                    amount: earnedCredit,
                    reason: `Reversal for cancelled order ${order._id}`,
                    source: 'cashback',
                    date: new Date()
                });
                await customer.save();
            }

            // 4. Update Main Order
            await customerOrder.findByIdAndUpdate(orderId, {
                delivery_status: 'cancelled'
            });

            // 5. Update Sub Orders
            await authOrderModel.updateMany({ orderId: new ObjectId(orderId) }, {
                delivery_status: 'cancelled'
            });

            responseReturn(res, 200, { message: 'Order cancelled and rewards reversed successfully' });
        } catch (error) {
            console.log('Customer order cancel error: ' + error.message);
            responseReturn(res, 500, { message: 'Internal server error' });
        }
    }

}
module.exports = new orderController() 