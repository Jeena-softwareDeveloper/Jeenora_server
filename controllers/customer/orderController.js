const authOrderModel = require('../../models/partner/AuthOrder')
const customerOrder = require('../../models/customer/customerOrder')

const myShopWallet = require('../../models/admin/myShopWallet')
const partnerWallet = require('../../models/partner/partnerWallet')

const cardModel = require('../../models/customer/cardModel')
const moment = require("moment")
const { responseReturn } = require('../../utils/response')
const { mongo: { ObjectId } } = require('mongoose')
const productModel = require('../../models/partner/Product')
const wearProductModel = require('../../models/partner/WearProduct')
const { ORDER_STATUS, isValidTransition } = require('../../utils/orderValidators')
const customerModel = require('../../models/customer/Customer')
const wearAuditLogModel = require('../../models/admin/wearAuditLogModel')
const WearNotification = require('../../models/admin/WearNotification');
const shiprocketService = require('../../utils/shiprocketService');

const { sendEmail } = require('../../utils/emailSender');
const partnerModel = require('../../models/partner/Partner');
const aiService = require('../../utils/aiService');
const whatsappClient = require('../../utils/whatsappClient');
const { Cashfree, CFEnvironment } = require('cashfree-pg');
const WearBuyer = require('../../models/customer/wearBuyerModel');

const cashfreeInstance = new Cashfree();
cashfreeInstance.XClientId = process.env.CASHFREE_APP_ID;
cashfreeInstance.XClientSecret = process.env.CASHFREE_SECRET_KEY;
cashfreeInstance.XEnvironment = process.env.CASHFREE_ENVIRONMENT === 'PRODUCTION' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;

class orderController {
    // Helper to send beautiful transactional emails
    send_order_notifications = async (order, type = 'placed') => {
        try {
            const customer = await customerModel.findById(order.customerId || order.userId).select('+notificationSettings');
            if (!customer) return;

            const settings = customer.notificationSettings || { orderUpdates: true, emailNotifications: true, whatsappNotifications: true };
            
            // 1. EMAIL NOTIFICATION (CUSTOMER)
            if (customer.email && settings.emailNotifications && settings.orderUpdates) {
                let subject = '';
                let html = '';

                if (type === 'placed' || type === 'paid') {
                    subject = `Order Confirmed - #${order._id.toString().slice(-8).toUpperCase()}`;
                    html = `
                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #f0f0f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
                            <div style="background: linear-gradient(135deg, #7C3AED, #4F46E5); padding: 40px 20px; text-align: center;">
                                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">ORDER CONFIRMED</h1>
                                <p style="color: #E0E7FF; margin-top: 10px; font-weight: 500;">Thank you for shopping with Jeenora Wear</p>
                            </div>
                            <div style="padding: 40px; background: #ffffff;">
                                <h2 style="color: #1F2937; margin-top: 0; font-size: 20px;">Hi ${customer.name},</h2>
                                <p style="color: #4B5563; line-height: 1.6;">Your order <b>#${order._id.toString().slice(-8).toUpperCase()}</b> has been successfully placed and is being processed by our vendors.</p>
                                
                                <div style="margin: 30px 0; padding: 25px; background: #F9FAFB; border-radius: 12px; border: 1px dashed #E5E7EB;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                                        <span style="color: #6B7280; font-size: 14px;">Total Amount:</span>
                                        <span style="color: #111827; font-weight: 800; font-size: 18px;">₹${order.price}</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between;">
                                        <span style="color: #6B7280; font-size: 14px;">Status:</span>
                                        <span style="color: #059669; font-weight: 700; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">${type === 'paid' ? 'Paid & Confirmed' : 'Payment Pending'}</span>
                                    </div>
                                </div>

                                <p style="color: #4B5563; line-height: 1.6;">We'll notify you once your items are shipped.</p>
                                
                                <a href="https://jeenora.com/orders" style="display: inline-block; margin-top: 20px; background: #7C3AED; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Track My Order</a>
                            </div>
                            <div style="background: #F9FAFB; padding: 25px; text-align: center; border-top: 1px solid #F3F4F6;">
                                <p style="margin: 0; color: #9CA3AF; font-size: 12px;">&copy; ${new Date().getFullYear()} Jeenora Enterprise. Built for Fashion.</p>
                            </div>
                        </div>
                    `;
                } else if (type === 'status_update') {
                    subject = `Your Order is ${order.delivery_status.toUpperCase()} - #${order._id.toString().slice(-8).toUpperCase()}`;
                    const statusColor = order.delivery_status === 'shipped' ? '#3B82F6' : order.delivery_status === 'delivered' ? '#10B981' : '#7C3AED';
                    html = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
                            <div style="background: ${statusColor}; padding: 30px; text-align: center;">
                                <h1 style="color: white; margin: 0; font-size: 24px;">ORDER UPDATE</h1>
                            </div>
                            <div style="padding: 40px;">
                                <p style="font-size: 16px; color: #333;">Great news! Your order status has been updated to:</p>
                                <div style="margin: 20px 0; font-size: 32px; font-weight: 900; color: ${statusColor}; text-align: center; text-transform: uppercase;">
                                    ${order.delivery_status}
                                </div>
                                <p style="color: #666; font-size: 14px;">Order ID: #${order._id.toString().slice(-8).toUpperCase()}</p>
                            </div>
                        </div>
                    `;
                }

                if (subject && html) await sendEmail(customer.email, subject, '', html);
            }

            // 2. WHATSAPP NOTIFICATION (CUSTOMER)
            if (customer.phone && settings.whatsappNotifications && settings.orderUpdates) {
                try {

                    const orderIdShort = order._id.toString().slice(-8).toUpperCase();
                    
                    const waMessage = await aiService.generateNotificationMessage('user', type, {
                        name: customer.name,
                        orderId: orderIdShort,
                        price: order.price,
                        status: order.delivery_status,
                        trackingUrl: order.awb_number ? `https://shiprocket.co/tracking/${order.awb_number}` : null
                    });

                    console.log(`[WA_NOTIFICATION] Sending to customer: ${customer.phone}`);
                    await whatsappClient.sendMessage(customer.phone, waMessage);
                    console.log(`[WA_NOTIFICATION] Successfully sent to customer: ${customer.phone}`);
                } catch (waError) {
                    console.error('[AI Order Notification] Customer WhatsApp failed:', waError.message);
                }
            }

            // Notify Partners if first time placed
            const shouldNotifyPartner = (type === 'paid') || (type === 'placed' && order.payment_method === 'COD');

            if (shouldNotifyPartner) {
                const subOrders = await authOrderModel.find({ orderId: order._id });
                for (const sub of subOrders) {
                    const partner = await partnerModel.findById(sub.partnerId);
                    const supplier = await require('../../models/partner/Supplier').findById(sub.partnerId);
                    
                    // Fetch Partner's main account for settings
                    let partnerAccount = null;
                    if (supplier && supplier.user) {
                        partnerAccount = await WearBuyer.findById(supplier.user).select('+notificationSettings');
                    }
                    const sSettings = partnerAccount?.notificationSettings || { orderUpdates: true, emailNotifications: true, whatsappNotifications: true };

                    if (supplier && supplier.user && sSettings.orderUpdates) {
                        await WearNotification.create({
                            userId: supplier.user,
                            title: 'New Multi-Vendor Order',
                            message: `You have a new order (#${order._id.toString().slice(-8).toUpperCase()}) for ₹${sub.price}. Please process it.`,
                            type: 'order',
                            metadata: { orderId: sub._id, mainOrderId: order._id }
                        });
                    }

                    if (partner && partner.email && sSettings.emailNotifications && sSettings.orderUpdates) {
                        const sSubject = `New Order Received! #${order._id.toString().slice(-8).toUpperCase()}`;
                        const sHtml = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
                                <div style="background: #111827; padding: 25px; text-align: center;">
                                    <h1 style="color: white; margin: 0; font-size: 20px;">NEW INCOMING ORDER</h1>
                                </div>
                                <div style="padding: 30px;">
                                    <h2 style="color: #333;">Action Required!</h2>
                                    <p>You have received a new order for ${sub.products.length} items.</p>
                                    <p style="font-size: 18px; font-weight: bold;">Order Value: ₹${sub.price}</p>
                                    <a href="https://dashboard.jeenora.com/supplier-orders" style="display:inline-block; margin-top: 20px; background: #E11955; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">PROCESS ORDER</a>
                                </div>
                            </div>
                        `;
                        await sendEmail(partner.email, sSubject, '', sHtml);
                    }

                    // --- AI WHATSAPP NOTIFICATION (PARTNER) ---
                    if (partner && partner.phoneNumber && sSettings.whatsappNotifications && sSettings.orderUpdates) {
                        try {

                            const orderIdShort = order._id.toString().slice(-8).toUpperCase();
                            
                            const sWaMessage = await aiService.generateNotificationMessage('supplier', 'order_received', {
                                shopName: supplier?.businessDetails?.shopName || partner.name,
                                orderId: orderIdShort,
                                price: sub.price,
                                itemCount: sub.products.length
                            });

                            console.log(`[WA_NOTIFICATION] Sending to partner: ${partner.phoneNumber}`);
                            await whatsappClient.sendMessage(partner.phoneNumber, sWaMessage);
                            console.log(`[WA_NOTIFICATION] Successfully sent to partner: ${partner.phoneNumber}`);
                        } catch (waError) {
                            console.error('[AI Order Notification] Partner WhatsApp failed:', waError.message);
                        }
                    }
                }
            }
        } catch (err) {

        }
    }

    push_to_shiprocket = async (orderId, isSubOrder = false) => {
        try {
            const model = isSubOrder ? authOrderModel : customerOrder;
            const order = await model.findById(orderId);
            if (!order) return;

            let mainOrder = order;
            if (isSubOrder) {
                mainOrder = await customerOrder.findById(order.orderId);
                if (!mainOrder) return;
            }

            const customer = await customerModel.findById(mainOrder.customerId);
            
            // For Shiprocket, we need a unique Order ID. 
            // If it's a sub-order, we append a suffix.
            const uniqueOrderId = isSubOrder ? `${order._id}_S` : order._id.toString();

            // Format data for Shiprocket
            const shipData = {
                order_id: uniqueOrderId,
                order_date: moment(order.createdAt).format('YYYY-MM-DD HH:mm'),
                pickup_location: "Primary", 
                billing_customer_name: mainOrder.shippingInfo?.name || customer?.name || 'Customer',
                billing_last_name: "",
                billing_address: mainOrder.shippingInfo?.address || mainOrder.shippingInfo?.houseNo || 'N/A',
                billing_city: mainOrder.shippingInfo?.city || 'N/A',
                billing_pincode: mainOrder.shippingInfo?.pincode || '000000',
                billing_state: mainOrder.shippingInfo?.state || "Tamil Nadu",
                billing_country: "India",
                billing_email: customer?.email || "info@jeenora.com",
                billing_phone: mainOrder.shippingInfo?.phone || customer?.phone || '0000000000',
                shipping_is_billing: true,
                order_items: order.products.map(p => ({
                    name: p.productName || p.name,
                    sku: p._id?.toString() || 'SKU',
                    units: p.quantity || 1,
                    selling_price: p.discountPrice || p.price || 0
                })),
                payment_method: mainOrder.payment_method === 'COD' ? 'Postpaid' : 'Prepaid',
                sub_total: order.price,
                // Dimensions (Placeholder - Should ideally come from product data)
                length: 10, breadth: 10, height: 10, weight: 0.5
            };

            // --- AI ADDRESS SCRUBBING ---
            try {
                const cleanAddress = await aiService.scrubAddress({
                    houseNo: mainOrder.shippingInfo?.houseNo,
                    area: mainOrder.shippingInfo?.area,
                    city: mainOrder.shippingInfo?.city,
                    state: mainOrder.shippingInfo?.state,
                    pincode: mainOrder.shippingInfo?.pincode
                });
                
                if (cleanAddress && cleanAddress.pincode) {
                    shipData.billing_address = `${cleanAddress.houseNo || ''} ${cleanAddress.area || ''}`.trim();
                    shipData.billing_city = cleanAddress.city;
                    shipData.billing_state = cleanAddress.state;
                    shipData.billing_pincode = cleanAddress.pincode;
                }
            } catch (err) {

            }

            const srResponse = await shiprocketService.createOrder(shipData);
            if (srResponse && srResponse.order_id) {
                // --- AI SMART COURIER SELECTION ---
                let finalAwb = srResponse.awb_number;
                try {
                    const couriers = await shiprocketService.getCouriers(srResponse.shipment_id);
                    if (couriers && couriers.length > 0) {
                        const bestCourierId = await aiService.pickBestCourier(couriers, { city: shipData.billing_city });
                        if (bestCourierId) {
                            const assignRes = await shiprocketService.assignCourier(srResponse.shipment_id, bestCourierId);
                            if (assignRes && assignRes.response?.data?.awb_code) {
                                finalAwb = assignRes.response.data.awb_code;
                            }
                        }
                    }
                } catch (err) {

                }

                await model.findByIdAndUpdate(orderId, {
                    shiprocket_order_id: srResponse.order_id,
                    shiprocket_shipment_id: srResponse.shipment_id,
                    awb_number: finalAwb || srResponse.awb_number,
                    label_url: srResponse.label_url,
                    is_high_risk: false,
                    risk_score: 0
                });

                return srResponse;
            }
        } catch (err) {
            console.error(`[SHIPROCKET] Sync failed for ${orderId}:`, err.message);
        }
    }

    paymentCheck = async (id) => {
        try {
            const order = await customerOrder.findById(id)
            if (order && order.payment_status === 'unpaid' && order.delivery_status !== 'cancelled') {
                // Mark as cancelled
                await customerOrder.findByIdAndUpdate(id, {
                    delivery_status: 'cancelled'
                })
                await authOrderModel.updateMany({
                    orderId: id
                }, {
                    delivery_status: 'cancelled'
                })

                // --- STOCK REVERSION LOGIC (RESERVED STOCK) ---
                // If reserved stock was increased at order time, we must release it now.
                if (order.stock_decreased) {
                    for (const item of order.products) {
                        const isWear = !!item.variants || !!item.size;
                        if (isWear) {
                            await wearProductModel.findOneAndUpdate(
                                { _id: item._id, "variants.size": item.size },
                                { $inc: { "variants.$.reservedStock": -item.quantity } }
                            );
                        } else {
                            await productModel.findByIdAndUpdate(
                                item._id,
                                { $inc: { reservedStock: -item.quantity } }
                            );
                        }
                    }
                    // Mark as reverted
                    await customerOrder.findByIdAndUpdate(id, { stock_decreased: false });
                    await authOrderModel.updateMany({ orderId: id }, { stock_decreased: false });
                    console.log(`[STOCK_REVERT] Reserved inventory released for expired order: ${id}`);
                }
            }
            return true
        } catch (error) {
            console.error('[PAYMENT_CHECK_ERROR]', error.message);
        }
    }
    
    place_order = async (req, res) => {
        const { price, products, shipping_fee, shippingInfo, userId, payment_method } = req.body;
        const initial_delivery_status = payment_method !== 'COD' ? 'pending_payment' : 'pending';
        let authorOrderData = []
        let cardId = []
        const tempDate = moment(Date.now()).format('LLL')

        let customerOrderProduct = []

        for (let i = 0; i < products.length; i++) {
            const pro = products[i].products
            for (let j = 0; j < pro.length; j++) {
                // Use spread to avoid polluting original product info references
                const tempCusPro = { ...pro[j].productInfo }; 
                tempCusPro.quantity = pro[j].quantity
                customerOrderProduct.push(tempCusPro)
                if (pro[j]._id) {
                    cardId.push(pro[j]._id)
                }
            }
        }

        try {
            // --- ATOMIC STOCK LOCKING ---
            // We decrease stock immediately to prevent overselling. 
            // If payment fails or is not completed within 15-30 mins, we will revert it.
            for (let i = 0; i < products.length; i++) {
                const pro = products[i].products;
                for (let j = 0; j < pro.length; j++) {
                    const item = pro[j];
                    const productInfo = item.productInfo;
                    const requestedQty = item.quantity;
                    const isWear = !!productInfo.variants;

                    if (isWear) {
                        // ATOMIC-ISH STOCK CHECK
                        const actualProduct = await wearProductModel.findById(productInfo._id);
                        if (!actualProduct) {
                            return responseReturn(res, 404, { error: `Product not found: ${productInfo.productName}` });
                        }

                        const size = item.size || productInfo.variants[0].size;
                        const variant = (actualProduct.variants || []).find(v => v.size === size);
                        
                        if (!variant || (variant.stock - (variant.reservedStock || 0)) < requestedQty) {
                            return responseReturn(res, 400, {
                                error: `Insufficient stock for ${productInfo.productName} (Size: ${size}). Available: ${variant ? variant.stock - (variant.reservedStock || 0) : 0}`
                            });
                        }

                        const result = await wearProductModel.findOneAndUpdate(
                            {
                                _id: productInfo._id,
                                "variants.size": size,
                            },
                            {
                                $inc: { "variants.$.reservedStock": requestedQty }
                            },
                            { new: true }
                        );

                        if (!result) {
                            return responseReturn(res, 400, {
                                error: `Insufficient stock for ${productInfo.name || productInfo.productName}. Please adjust quantity.`
                            });
                        }
                    } else {
                        // ATOMIC STOCK CHECK FOR LEGACY PRODUCT
                        const result = await productModel.findOneAndUpdate(
                            {
                                _id: productInfo._id,
                                $expr: {
                                    $gte: [
                                        { $subtract: ["$stock", { $ifNull: ["$reservedStock", 0] }] },
                                        requestedQty
                                    ]
                                }
                            },
                            {
                                $inc: { reservedStock: requestedQty }
                            },
                            { new: true }
                        );

                        if (!result) {
                            return responseReturn(res, 400, {
                                error: `Insufficient stock for ${productInfo.name || productInfo.productName}. Please adjust quantity.`
                            });
                        }
                    }
                }
            }

            const COMMISSION_RATE = 0; // Flat 0% commission (Jeenora doesn't take commission per product)
            let totalCommission = 0;

            for (let i = 0; i < products.length; i++) {
                const pro = products[i].products;
                const pri = products[i].price; // This is the subtotal for this partner
                let partnerId = products[i].partnerId;
                if (partnerId && typeof partnerId === 'object' && partnerId._id) {
                    partnerId = partnerId._id;
                }

                const commAmount = Math.round(pri * (COMMISSION_RATE / 100));
                const partAmount = pri - commAmount;
                totalCommission += commAmount;

                let storePor = [];
                for (let j = 0; j < pro.length; j++) {
                    const tempPro = { ...pro[j].productInfo };
                    tempPro.quantity = pro[j].quantity;
                    storePor.push(tempPro);
                }

                authorOrderData.push({
                    orderId: null, // Will be set after order.id is available, or use order._id if created first
                    partnerId,
                    products: storePor,
                    price: pri,
                    payment_status: 'unpaid',
                    shippingInfo: shippingInfo,
                    delivery_status: 'pending',
                    date: tempDate,
                    commissionRate: COMMISSION_RATE,
                    commissionAmount: commAmount,
                    partnerAmount: partAmount
                });
            }

            const order = await customerOrder.create({
                customerId: userId,
                shippingInfo,
                products: customerOrderProduct,
                price: price + shipping_fee,
                payment_status: 'unpaid',
                payment_method,
                delivery_status: initial_delivery_status,
                date: tempDate,
                totalCommission: totalCommission,
                cartItemIds: cardId,
                stock_decreased: true // Stock already deducted atomically
            });

            // Update orderId and stats for suborders
            authorOrderData = authorOrderData.map(o => ({ 
                ...o, 
                orderId: order.id, 
                delivery_status: initial_delivery_status,
                stock_decreased: true // Stock already deducted atomically
            }));
            await authOrderModel.insertMany(authorOrderData);
            
            if (payment_method === 'COD') {
                // --- RTO RISK CHECK FOR COD ---
                // For critical/high-risk areas, we only allow UPI/Prepaid
                try {
                    const risk = await shiprocketService.getRtoRisk(shippingInfo.phone);
                    if (risk && (risk.risk_score > 70 || risk.status === 'high_risk')) {
                        // REVERT RESERVED STOCK
                        for (let i = 0; i < products.length; i++) {
                            const pro = products[i].products;
                            for (let j = 0; j < pro.length; j++) {
                                const item = pro[j];
                                const isWear = !!item.productInfo.variants;
                                if (isWear) {
                                    await wearProductModel.findOneAndUpdate(
                                        { _id: item.productInfo._id, "variants.size": item.size || item.productInfo.variants[0].size },
                                        { $inc: { "variants.$.reservedStock": -item.quantity } }
                                    );
                                } else {
                                    await productModel.findByIdAndUpdate(
                                        item.productInfo._id,
                                        { $inc: { reservedStock: -item.quantity } }
                                    );
                                }
                            }
                        }
                        
                        return responseReturn(res, 400, { 
                            error: "COD is not available for this address/phone due to high delivery risk. Please use 'Online Payment' (UPI/Card) to complete your order." 
                        });
                    }
                    
                    // If safe, mark it anyway for partner awareness
                    if (risk) {
                        order.is_high_risk = false;
                        order.risk_score = risk.risk_score || 0;
                        await order.save();
                    }
                } catch (riskErr) {
                    // If risk check fails, we allow it (don't block legitimate users)
                }

                for (let k = 0; k < cardId.length; k++) {
                    await cardModel.findByIdAndDelete(cardId[k])
                }
            }
            
            // Start Notification & Shiprocket Sync (Async)
            this.send_order_notifications(order, order.payment_status === 'paid' ? 'paid' : 'placed');
            
            if (payment_method === 'COD') {
                this.push_to_shiprocket(order._id);
            } else {
                // --- AUTO-CANCELLATION TIMER ---
                // If payment is not completed, revert stock after 20 minutes (15 min window + buffer)
                setTimeout(() => {
                    this.paymentCheck(order._id);
                }, 20 * 60 * 1000);
            }

            const successMsg = payment_method === 'ONLINE' ? "Order initiated! Redirecting to payment..." : "Order placed successfully";
            responseReturn(res, 201, { message: successMsg, orderId: order._id });

        } catch (error) {
            console.error('[PLACE_ORDER] Error:', error.message);
            return responseReturn(res, 500, { error: error.message || 'Internal Server Error' });
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

        }
    }

    

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
                recentOrders: recentOrdersRaw.map(o => {
                    const mappedProducts = (o.products || []).map(p => {
                        const variantName = p.variants?.[0]?.color || p.variants?.[0]?.name || p.color;
                        const finalName = variantName || (p.productName || p.name);
                        return { ...p, productName: finalName, name: finalName };
                    });
                    return {
                        _id: o._id,
                        products: mappedProducts,
                        price: o.price,
                        payment_status: o.payment_status,
                        delivery_status: o.delivery_status,
                        date: o.date,
                        shippingInfo: o.shippingInfo || 'Standard Delivery'
                    };
                }),
                pendingOrder,
                totalOrder,
                cancelledOrder
            })

        } catch (error) {

            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }
    

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

            responseReturn(res, 200, { 
                orders: ordersRaw.map(o => {
                    const mappedProducts = (o.products || []).map(p => {
                        const variantName = p.variants?.[0]?.color || p.variants?.[0]?.name || p.color;
                        const finalName = variantName || (p.productName || p.name);
                        return { ...p, productName: finalName, name: finalName };
                    });
                    return {
                        _id: o._id,
                        products: mappedProducts,
                        price: o.price,
                        payment_status: o.payment_status,
                        delivery_status: o.delivery_status,
                        date: o.date,
                        shippingInfo: o.shippingInfo || 'Standard Delivery'
                    };
                })
            })
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }
    

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
                order[0].suborders = order[0].suborders.map(so => {
                    const mappedProducts = (so.products || []).map(p => {
                        const variantName = p.variants?.[0]?.color || p.variants?.[0]?.name || p.color;
                        const finalName = variantName || (p.productName || p.name);
                        return { ...p, productName: finalName, name: finalName };
                    });
                    return {
                        _id: so._id,
                        partnerId: so.partnerId,
                        products: mappedProducts,
                        price: so.price,
                        delivery_status: so.delivery_status,
                        date: so.date
                        // commissionAmount and partnerAmount are EXCLUDED here
                    };
                });
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

        }
    }
    

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

        }
    }
    
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

        }
    }
    
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

            // --- INVENTORY PHASE (SYNCED) ---
            if (status === 'delivered') {
                const subOrders = await authOrderModel.find({ orderId: new ObjectId(orderId) });
                for (const sub of subOrders) {
                    for (const item of sub.products) {
                        const isWear = !!item.variants || !!item.size;
                        if (isWear) {
                            await wearProductModel.findOneAndUpdate(
                                { _id: item._id, "variants.size": item.size },
                                { $inc: { "variants.$.stock": -item.quantity, "variants.$.reservedStock": -item.quantity } }
                            );
                        } else {
                            await productModel.findByIdAndUpdate(
                                item._id,
                                { $inc: { stock: -item.quantity, reservedStock: -item.quantity } }
                            );
                        }
                    }
                }
            }

            if (status === 'cancelled' || status === 'rto') {
                const subOrders = await authOrderModel.find({ orderId: new ObjectId(orderId) });
                for (const sub of subOrders) {
                    for (const item of sub.products) {
                        const isWear = !!item.variants || !!item.size;
                        if (isWear) {
                            await wearProductModel.findOneAndUpdate(
                                { _id: item._id, "variants.size": item.size },
                                { $inc: { "variants.$.reservedStock": -item.quantity } }
                            );
                        } else {
                            await productModel.findByIdAndUpdate(
                                item._id,
                                { $inc: { reservedStock: -item.quantity } }
                            );
                        }
                    }
                }
            }

            if (status === 'returned') {
                const subOrders = await authOrderModel.find({ orderId: new ObjectId(orderId) });
                for (const sub of subOrders) {
                    for (const item of sub.products) {
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

            responseReturn(res, 500, { message: 'internal server error' })
        }

    }
    
    get_partner_orders = async (req, res) => {
        const { partnerId } = req.params
        let { page, searchValue, parPage } = req.query
        page = parseInt(page)
        parPage = parseInt(parPage)
        const skipPage = parPage * (page - 1)
        try {
            if (searchValue) {

            } else {
                const orders = await authOrderModel.find({
                    partnerId
                }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })
                const totalOrder = await authOrderModel.find({
                    partnerId
                }).countDocuments()
                responseReturn(res, 200, { orders, totalOrder })
            }

        } catch (error) {

            responseReturn(res, 500, { message: 'internal server error' })
        }
    }
    
    get_partner_order = async (req, res) => {
        const { orderId } = req.params

        try {
            const order = await authOrderModel.findById(orderId)
            if (!order) return responseReturn(res, 404, { error: 'Order not found' });
            
            // Scrub order for partner: They don't need system-wide totals, just their portion
            const scrubbedOrder = {
                _id: order._id,
                orderId: order.orderId,
                products: order.products,
                price: order.price,
                delivery_status: order.delivery_status,
                payment_status: order.payment_status,
                date: order.date,
                partnerAmount: order.partnerAmount
            };

            responseReturn(res, 200, { order: scrubbedOrder })
        } catch (error) {

        }
    }
    
    partner_order_status_update = async (req, res) => {
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

            // --- INVENTORY PHASE (ADVANCED) ---
            // 1. RESERVATION (Accepting): Handled at place_order for MVP simplicity
            
            // 2. DELIVERY COMMITMENT: If moved to delivered
            if (status === 'delivered') {
                for (const item of order.products) {
                    const isWear = !!item.variants || !!item.size;
                    if (isWear) {
                        // Permanently remove from both Total and Reserved
                        await wearProductModel.findOneAndUpdate(
                            { _id: item._id, "variants.size": item.size },
                            { $inc: { "variants.$.stock": -item.quantity, "variants.$.reservedStock": -item.quantity } }
                        );
                    } else {
                        await productModel.findByIdAndUpdate(
                            item._id,
                            { $inc: { stock: -item.quantity, reservedStock: -item.quantity } }
                        );
                    }
                }
            }
            
            // 3. RECOVERY: If moved to cancelled or RTO
            if (status === 'cancelled' || status === 'rto') {
                for (const item of order.products) {
                    const isWear = !!item.variants || !!item.size;
                    if (isWear) {
                        // Release from Reserved only
                        await wearProductModel.findOneAndUpdate(
                            { _id: item._id, "variants.size": item.size },
                            { $inc: { "variants.$.reservedStock": -item.quantity } }
                        );
                    } else {
                        await productModel.findByIdAndUpdate(
                            item._id,
                            { $inc: { reservedStock: -item.quantity } }
                        );
                    }
                }
                await authOrderModel.findByIdAndUpdate(orderId, { stock_decreased: false });
            }

            // 4. RETURN (RTO): If returned back to inventory
            if (status === 'returned') {
                for (const item of order.products) {
                    const isWear = !!item.variants || !!item.size;
                    if (isWear) {
                        // Add back to Total
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

            // SYNC UPWARDS TO MAIN ORDER
            await this.sync_main_order_status(order.orderId);

            // Trigger notification if status is relevant for customer
            if (['confirmed', 'shipped', 'delivered', 'cancelled'].includes(status)) {
                const mainOrder = await customerOrder.findById(order.orderId);
                if (mainOrder) {
                    mainOrder.delivery_status = status; // Mock update for template
                    this.send_order_notifications(mainOrder, 'status_update');
                }
            } else if (['delayed', 'failed', 'ndr'].includes(status.toLowerCase())) {
                // --- AI SMART LOGISTICS SUPPORT ---
                const mainOrder = await customerOrder.findById(order.orderId);
                const customer = await customerModel.findById(mainOrder.customerId);
                if (customer && customer.phone) {
                    const aiMsg = await aiService.generateLogisticsSupportMessage(status === 'delayed' ? 'delay' : 'ndr', {
                        name: customer.name,
                        orderId: mainOrder._id.toString().slice(-8).toUpperCase(),
                        status: status,
                        itemName: mainOrder.products[0]?.name || 'Item'
                    });
                    await whatsappClient.sendMessage(customer.phone, aiMsg);
                }
            }

            responseReturn(res, 200, { message: 'order status updated successfully' })
        } catch (error) {

            responseReturn(res, 500, { message: 'internal server error' })
        }
    }
    

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
                await partnerWallet.create({
                    partnerId: auOrder[i].partnerId.toString(),
                    amount: auOrder[i].partnerAmount || auOrder[i].price, // Use stored Net or fallback to Full
                    month: splitTime[0],
                    year: splitTime[2]
                })
            }
            responseReturn(res, 200, { message: 'success' })

            // Post-payment sync
            this.push_to_shiprocket(orderId);


        } catch (error) {

        }

    }
    

    // ATOMIC STOCK LOCKING (NO OVERSELLING GUARANTEE)
    decrease_stock = async (req, res) => {
        const { productId } = req.params;
        const { quantity, size, isWearProduct } = req.body; // size and isWearProduct are optional

        try {
            let result;

            if (isWearProduct) {
                // We increment reservedStock instead of decreasing stock
                result = await wearProductModel.findOneAndUpdate(
                    {
                        _id: productId,
                        "variants.size": size
                    },
                    {
                        $inc: { "variants.$.reservedStock": quantity }
                    },
                    { new: true }
                );
            } else {
                // For standard products
                result = await productModel.findOneAndUpdate(
                    {
                        _id: productId
                    },
                    {
                        $inc: { reservedStock: quantity }
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

    
    // ATOMIC STOCK RELEASE (RECOVERY)
    increase_stock = async (req, res) => {
        const { productId } = req.params;
        const { quantity, size, isWearProduct } = req.body;

        try {
            let result;

            if (isWearProduct) {
                result = await wearProductModel.findByIdAndUpdate(
                    productId,
                    { $inc: { "variants.$[elem].reservedStock": -quantity } },
                    {
                        arrayFilters: [{ "elem.size": size }],
                        new: true
                    }
                );
            } else {
                result = await productModel.findByIdAndUpdate(
                    productId,
                    { $inc: { reservedStock: -quantity } },
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

    




    customer_order_cancel = async (req, res) => {
        const { orderId } = req.params;
        try {
            const order = await customerOrder.findById(orderId);
            if (!order) return responseReturn(res, 404, { message: 'Order not found' });

            // 1. Check if cancellation is allowed
            if (!['pending', 'confirmed'].includes(order.delivery_status)) {
                return responseReturn(res, 400, { message: 'Order cannot be cancelled at this stage' });
            }

            // 2. Release Reserved Stock
            if (order.stock_decreased) {
                for (const item of order.products) {
                    const isWear = !!item.variants || !!item.size;
                    if (isWear) {
                        await wearProductModel.findOneAndUpdate(
                            { _id: item._id, "variants.size": item.size },
                            { $inc: { "variants.$.reservedStock": -item.quantity } }
                        );
                    } else {
                        await productModel.findByIdAndUpdate(
                            item._id,
                            { $inc: { reservedStock: -item.quantity } }
                        );
                    }
                }
                // Mark as reverted
                await customerOrder.findByIdAndUpdate(orderId, { stock_decreased: false });
                await authOrderModel.updateMany({ orderId: new ObjectId(orderId) }, { stock_decreased: false });
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

            responseReturn(res, 500, { message: 'Internal server error' });
        }
    }
    customer_order_fail = async (req, res) => {
        const { orderId } = req.params;
        try {
            const order = await customerOrder.findById(orderId);
            if (!order) return responseReturn(res, 404, { message: 'Order not found' });

            // Only allow "failing" an order if it's currently awaiting payment
            if (order.delivery_status !== 'pending_payment') {
                return responseReturn(res, 400, { message: 'Order cannot be abandoned in this state' });
            }

            // Release Reserved Stock
            if (order.stock_decreased) {
                for (const item of order.products) {
                    const isWear = !!item.variants || !!item.size;
                    if (isWear) {
                        await wearProductModel.findOneAndUpdate(
                            { _id: item._id, "variants.size": item.size },
                            { $inc: { "variants.$.reservedStock": -item.quantity } }
                        );
                    } else {
                        await productModel.findByIdAndUpdate(
                            item._id,
                            { $inc: { reservedStock: -item.quantity } }
                        );
                    }
                }
                await customerOrder.findByIdAndUpdate(orderId, { stock_decreased: false });
            }

            await customerOrder.findByIdAndUpdate(orderId, { delivery_status: 'cancelled' });
            await authOrderModel.deleteMany({ orderId: new ObjectId(orderId) });

            responseReturn(res, 200, { message: 'Order abandoned and stock released' });
        } catch (error) {
            responseReturn(res, 500, { message: error.message });
        }
    }

    create_cashfree_order = async (req, res) => {
        const { orderId } = req.body;
        try {
            const order = await customerOrder.findById(orderId);
            if (!order) {
                return responseReturn(res, 404, { message: 'Order not found' });
            }

            let user = await customerModel.findById(order.customerId);
            if (!user) {

                user = await WearBuyer.findById(order.customerId);
            }

            if (!user) {
                return responseReturn(res, 404, { message: 'User associated with this order not found' });
            }
            
            const request = {
                "order_amount": order.price,
                "order_currency": "INR",
                "order_id": `order_${order._id}_${Date.now()}`,
                "customer_details": {
                    "customer_id": user._id.toString(),
                    "customer_phone": user.phone || "9999999999", 
                    "customer_name": user.name || user.username || "Customer",
                    "customer_email": user.email || "customer@example.com"
                },
                "order_meta": {
                    "return_url": `${(process.env.CASHFREE_ENVIRONMENT === 'PRODUCTION' ? (process.env.FRONTEND_URL?.replace('http://', 'https://') || 'https://jeenora.com') : process.env.FRONTEND_URL)}/payment/verify?order_id={order_id}&my_order_id=${order._id}`,
                    "notify_url": `${process.env.BACKEND_URL || 'https://api.jeenora.com'}/api/wear/orders/order/cashfree-webhook`
                }
            };

            const cashfreeResponse = await cashfreeInstance.PGCreateOrder(request);
            
            // Link the cashfree order id to our order for verification later
            await customerOrder.findByIdAndUpdate(orderId, {
                payment_id: request.order_id // Temporarily store the cashfree order id
            });

            responseReturn(res, 200, { cashfreeOrder: cashfreeResponse.data });

        } catch (error) {
            console.error('[CASHFREE_CREATE_ERROR]', error.response ? error.response.data : error.message);
            responseReturn(res, 500, { message: 'Cashfree order creation failed', error: error.response ? error.response.data : error.message });
        }
    }

    verify_cashfree_payment = async (req, res) => {
        const { cashfree_order_id, orderId } = req.body;

        try {
            const response = await cashfreeInstance.PGOrderFetchPayments(cashfree_order_id);
            const payments = response.data;

            // Check if any payment is successful
            const successPayment = payments.find(p => p.payment_status === 'SUCCESS');

            if (!successPayment) {
                return responseReturn(res, 400, { message: 'Payment not successful or pending' });
            }

            const order = await customerOrder.findById(orderId);
            if (!order) return responseReturn(res, 404, { message: 'Order not found' });
            
            if (order.payment_status === 'paid') {
                return responseReturn(res, 200, { message: 'Payment already verified' });
            }

            // Update order status
            await customerOrder.findByIdAndUpdate(orderId, {
                payment_status: 'paid',
                delivery_status: 'confirmed',
                payment_id: successPayment.cf_payment_id
            });

            await authOrderModel.updateMany({ orderId: new ObjectId(orderId) }, {
                payment_status: 'paid',
                delivery_status: 'confirmed',
                paymentId: successPayment.cf_payment_id
            });

            // Clear cart
            if (order.cartItemIds && order.cartItemIds.length > 0) {
                for (const cardId of order.cartItemIds) {
                    await cardModel.findByIdAndDelete(cardId);
                }
            }

            // Settle wallets
            const time = moment(Date.now()).format('l');
            const splitTime = time.split('/');

            await myShopWallet.create({
                amount: order.totalCommission || 0,
                month: splitTime[0],
                year: splitTime[2]
            });

            const auOrders = await authOrderModel.find({ orderId: new ObjectId(orderId) });
            for (const auOrder of auOrders) {
                await partnerWallet.create({
                    partnerId: auOrder.partnerId.toString(),
                    amount: auOrder.partnerAmount || auOrder.price,
                    month: splitTime[0],
                    year: splitTime[2]
                });
            }

            // Sync with Shiprocket after successful payment
            this.push_to_shiprocket(orderId);

            this.send_order_notifications(order, 'paid');

            responseReturn(res, 200, { message: 'Payment verified successfully!' });

        } catch (error) {
            console.error('[CASHFREE_VERIFY_ERROR]', error.response ? error.response.data : error.message);
            responseReturn(res, 500, { message: 'Verification failed', error: error.response ? error.response.data : error.message });
        }
    }
    // ============================================================
    // 🤖 AI LOGISTICS AUTOMATION (CRON JOB)
    // ============================================================
    automated_tracking_check = async () => {

        try {
            // Find orders that are shipped but not delivered
            const activeOrders = await customerOrder.find({
                delivery_status: { $in: ['shipped', 'out_for_delivery'] },
                awb_number: { $exists: true, $ne: null }
            });

            for (const order of activeOrders) {
                try {
                    const tracking = await shiprocketService.trackAWB(order.awb_number);
                    const statusData = tracking.tracking_data?.shipment_track?.[0];
                    if (!statusData) continue;

                    const currentStatus = statusData.current_status.toLowerCase();
                    const scanData = statusData.shipment_track_activities || [];

                    // 1. Check for Smart Delay Prediction (Rain, Hub, Weather)
                    const lastActivity = scanData[0]?.activity || '';
                    const isDelayed = ['delayed', 'stuck', 'held', 'rain', 'weather', 'hub issue'].some(kw => 
                        lastActivity.toLowerCase().includes(kw) || currentStatus.includes(kw)
                    );

                    if (isDelayed) {
                        const customer = await customerModel.findById(order.customerId);
                        if (customer && customer.phone) {
                            const aiMsg = await aiService.generateLogisticsSupportMessage('delay', {
                                name: customer.name,
                                orderId: order._id.toString().slice(-8).toUpperCase(),
                                status: lastActivity || currentStatus,
                                itemName: order.products[0]?.name || 'Item'
                            });
                            await whatsappClient.sendMessage(customer.phone, aiMsg);
                        }
                    }

                    // 2. Check for Proactive NDR Resolution
                    if (currentStatus.includes('undelivered') || currentStatus.includes('failed')) {
                        const customer = await customerModel.findById(order.customerId);
                        if (customer && customer.phone) {
                            const aiMsg = await aiService.generateLogisticsSupportMessage('ndr', {
                                name: customer.name,
                                orderId: order._id.toString().slice(-8).toUpperCase(),
                                status: currentStatus,
                                itemName: order.products[0]?.name || 'Item'
                            });
                            await whatsappClient.sendMessage(customer.phone, aiMsg);
                        }
                    }
                } catch (err) {
                    console.error(`[AI LOGISTICS] Tracking failed for ${order._id}:`, err.message);
                }
            }
        } catch (error) {
            console.error('[AI LOGISTICS CRON] Error:', error);
        }
    }

    check_rto_risk = async (req, res) => {
        const { mobile } = req.params;
        try {
            const shiprocketService = require('../../utils/shiprocketService');
            // Shiprocket returns something like: { risk_score: 0.8, reason: "High return rate" }
            const riskData = await shiprocketService.getRtoRisk(mobile);
            responseReturn(res, 200, { success: true, data: riskData });
        } catch (error) {
            // Default to safe if API fails to not block users
            responseReturn(res, 200, { success: true, data: { risk_score: 0 } });
        }
    }


    get_dynamic_shipping_rate = async (req, res) => {
        const { pincode } = req.params;
        const { weight = 0.5, cod = 0 } = req.query;
        try {
            console.log(`[SHIPPING_CHECK] Pincode: ${pincode}, Weight: ${weight}, COD: ${cod}`);
            const shiprocketService = require('../../utils/shiprocketService');
            const rateData = await shiprocketService.getShippingRate('641001', pincode, Number(weight), Number(cod));
            
            if (rateData) {
                console.log(`[SHIPPING_SUCCESS] Rate: ${rateData.rate}`);
                responseReturn(res, 200, { success: true, data: rateData });
            } else {
                console.warn(`[SHIPPING_FAIL] No couriers found for pincode: ${pincode}`);
                responseReturn(res, 400, { error: 'Courier not serviceable for this pincode' });
            }
        } catch (error) {
            console.error('[SHIPPING_ERROR]', error.message);
            responseReturn(res, 500, { error: 'Failed to calculate shipping rate' });
        }
    }

    shiprocket_webhook = async (req, res) => {
        const payload = req.body;
        console.log('[SHIPROCKET WEBHOOK] Received:', payload.awb, payload.current_status);

        try {
            const { awb, current_status, shipment_id } = payload;
            
            const order = await customerOrder.findOne({ 
                $or: [{ awb_number: awb }, { shiprocket_shipment_id: shipment_id }] 
            });

            if (!order) {
                return res.status(200).send('Order not found');
            }

            const status = current_status?.toLowerCase() || '';

            if (status.includes('undelivered') || status.includes('failed') || status.includes('return') || status.includes('rto')) {
                const customer = await customerModel.findById(order.customerId);
                if (customer && customer.phone) {
                    const aiMsg = await aiService.generateLogisticsSupportMessage('ndr', {
                        name: customer.name,
                        orderId: order._id.toString().slice(-8).toUpperCase(),
                        status: current_status,
                        itemName: order.products[0]?.name || 'Item'
                    });
                    await whatsappClient.sendMessage(customer.phone, aiMsg);
                }
            }

            res.status(200).send('OK');
        } catch (error) {
            console.error('[SHIPROCKET WEBHOOK] Error:', error);
            res.status(500).send('Error processing webhook');
        }
    }
}

module.exports = new orderController()

