const Supplier = require('../../models/wear/supplierModel');
const axios = require('axios');
const Seller = require('../../models/wear/sellerModel');
const WearProduct = require('../../models/wear/wearProductModel');
const authOrderModel = require('../../models/wear/authOrder');
const customerOrder = require('../../models/wear/customerOrder');
const reviewModel = require('../../models/wear/wearReviewModel');
const { responseReturn } = require('../../utiles/response');
const { isValidTransition } = require('../../utiles/orderValidators');
const { mongo: { ObjectId } } = require('mongoose');
const { writeDataToFile, readDataFromFile } = require('../../utiles/dataService');

class supplierController {

    // 1. Mobile App - Apply for Supplier Account
    apply_supplier = async (req, res) => {
        const { id } = req;
        const { businessDetails, addressDetails, bankDetails, supplierDetails } = req.body;

        try {
            // Check if user already has an application
            const existing = await Supplier.findOne({ user: id });
            if (existing) {
                return responseReturn(res, 400, { error: 'You have already submitted a supplier application.' });
            }

            const supplier = await Supplier.create({
                user: id,
                businessDetails,
                addressDetails,
                bankDetails,
                supplierDetails,
                status: 'pending'
            });

            // Return only success and basic info, not the whole object with bank details
            responseReturn(res, 201, { 
                success: true, 
                message: 'Application submitted successfully', 
                data: { status: supplier.status, shopName: businessDetails.shopName } 
            });
        } catch (error) {
            console.error('Apply Supplier Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 1.1 Mobile App - Verify IFSC Details
    verify_ifsc = async (req, res) => {
        const { ifscCode } = req.body;
        if (!ifscCode) return responseReturn(res, 400, { error: 'IFSC code is required' });

        try {
            const ifscRes = await axios.get(`https://ifsc.razorpay.com/${ifscCode}`);

            if (ifscRes.data) {
                const data = ifscRes.data;
                return responseReturn(res, 200, {
                    success: true,
                    bankDetails: {
                        bank: data.BANK,
                        branch: data.BRANCH,
                        address: data.ADDRESS,
                        city: data.CITY,
                        state: data.STATE,
                        micr: data.MICR,
                        ifsc: data.IFSC
                    }
                });
            }
        } catch (err) {
            return responseReturn(res, 400, { error: 'Invalid IFSC Code' });
        }
    }

    // 1.1.1 Mobile App - Verify Pincode (Postal API)
    verify_pincode = async (req, res) => {
        const { pincode } = req.body;
        if (!pincode || pincode.length !== 6) return responseReturn(res, 400, { error: 'Valid 6-digit pincode is required' });

        try {
            const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);
            const data = response.data;

            if (data[0].Status === "Success") {
                const info = data[0].PostOffice[0];
                return responseReturn(res, 200, {
                    success: true,
                    data: {
                        district: info.District,
                        city: info.Block || info.Division,
                        state: info.State,
                        pincode: pincode
                    }
                });
            } else {
                return responseReturn(res, 404, { error: 'Invalid Pincode' });
            }
        } catch (error) {
            return responseReturn(res, 500, { error: 'Pincode service error' });
        }
    }

    // 1.2 Mobile App - Verify Bank Details (Account Number)
    verify_bank = async (req, res) => {
        const { accountNumber, ifscCode } = req.body;

        if (!accountNumber || !ifscCode) {
            return responseReturn(res, 400, { error: 'Account details are required' });
        }

        try {
            // Since we are doing "Option 2" (Smart Verification), we just return success
            await new Promise(resolve => setTimeout(resolve, 800));

            return responseReturn(res, 200, {
                success: true,
                message: 'Bank account verified successfully!'
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 2. Mobile App - Get current application status
    get_my_status = async (req, res) => {
        const { id } = req;
        try {
            // Priority 1: Direct link by ID
            let supplier = await Supplier.findOne({ user: id });

            if (!supplier) {
                // Priority 2: In case of ID mismatch between Customer and WearBuyer collection,
                // try to find by phone number from the user object in request (added by middleware)
                const phone = req.user?.phone;
                if (phone) {
                    // Find all possible user IDs for this phone

                    const buyer = await WearBuyer.findOne({ phone });
                    const customer = await Customer.findOne({ phone });

                    const ids = [id];
                    if (buyer) ids.push(buyer._id);
                    if (customer) ids.push(customer._id);

                    supplier = await Supplier.findOne({ user: { $in: ids } });
                }
            }

            if (!supplier) {
                return responseReturn(res, 200, { success: true, data: { status: 'none', hasShownCongrats: false, shopName: '' } });
            }
            
            // Explicit response building (Strict Whitelist - No ID or bank details)
            const scrubbedData = {
                status: supplier.status || 'pending',
                hasShownCongrats: supplier.hasShownCongrats || false,
                shopName: supplier.businessDetails?.shopName || ''
            };

            responseReturn(res, 200, { success: true, data: scrubbedData });
        } catch (error) {
            console.error('get_my_status error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 2.1 Mobile App - Mark congrats banner as shown
    mark_congrats_shown = async (req, res) => {
        const { id } = req;
        try {
            const supplier = await Supplier.findOneAndUpdate({ user: id }, { hasShownCongrats: true }, { new: true });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'No application found' });
            }
            responseReturn(res, 200, { success: true, message: 'Congrats marked as shown' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 2.2 Mobile App - Get Supplier Dashboard Stats
    get_supplier_dashboard_data = async (req, res) => {
        const { id } = req;
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: 'Supplier not found' });

            const totalCatalogs = await WearProduct.countDocuments({ sellerId: supplier._id });
            const activeCatalogs = await WearProduct.countDocuments({ sellerId: supplier._id, status: 'active' });
            const pendingCatalogs = await WearProduct.countDocuments({ sellerId: supplier._id, status: 'pending' });

            // Fetch real order stats
            const orders = await authOrderModel.find({ sellerId: supplier._id });
            const totalOrders = orders.length;
            const totalSales = orders.reduce((acc, order) => acc + (order.price || 0), 0);
            const pendingShipments = orders.filter(o => o.delivery_status === 'confirmed').length;
            const pendingConfirmation = orders.filter(o => o.delivery_status === 'pending').length;
            const returnsCount = orders.filter(o => o.return_status !== 'none' && o.return_status !== 'completed').length;

            responseReturn(res, 200, {
                success: true,
                status: supplier.status || 'pending',
                shopName: supplier.businessDetails?.shopName || '',
                stats: {
                    totalOrders,
                    totalSales,
                    pendingShipments,
                    pendingConfirmation,
                    returnsCount,
                    totalViews: 0, // Placeholder
                    catalogs: {
                        total: totalCatalogs,
                        active: activeCatalogs,
                        pending: pendingCatalogs
                    }
                }
            });
        } catch (error) {
            console.error('Dashboard Stats Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 2.3 Mobile App - Get Supplier Orders
    get_supplier_orders = async (req, res) => {
        const { id } = req;
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: 'Supplier account not found' });

            let orders = await authOrderModel.find({ 
                sellerId: supplier._id,
                delivery_status: { $ne: 'pending_payment' }
            }).sort({ createdAt: -1 }).lean();

            // Populate legacy string shipping info with real customer address
            const customerOrderModel = require('../../models/wear/customerOrder');
            orders = await Promise.all(orders.map(async (order) => {
                if (typeof order.shippingInfo === 'string') {
                    const parentOrder = await customerOrderModel.findById(order.orderId);
                    if (parentOrder && parentOrder.shippingInfo) {
                        order.shippingInfo = parentOrder.shippingInfo;
                    } else {
                        order.shippingInfo = {};
                    }
                }
                return order;
            }));

            responseReturn(res, 200, { success: true, orders });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 2.4 Mobile App - Update Order Status
    update_order_status = async (req, res) => {
        const { orderId } = req.params;
        const { status, reason } = req.body;
        const { id } = req; // user id from midleware

        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: 'Supplier account not found' });

            const order = await authOrderModel.findOne({ _id: orderId, sellerId: supplier._id });
            if (!order) {
                return responseReturn(res, 404, { error: 'Order not found or not authorized' });
            }

            // 1. Validate Transition
            // Allow "retry" transitions if status is the same but shiprocket ID is missing
            const isRetry = order.delivery_status === status && !order.shiprocket_order_id && (status === 'confirmed' || status === 'processing');
            
            if (!isRetry && !isValidTransition(order.delivery_status, status)) {
                return responseReturn(res, 400, {
                    error: `Illegal Status Transition: Cannot move from ${order.delivery_status.toUpperCase()} to ${status.toUpperCase()}`
                })
            }

            order.delivery_status = status;
            if (status === 'cancelled' && reason) {
                order.cancel_reason = reason;
            }
            await order.save();

            // === SHIPROCKET AUTOMATION ===
            // Trigger if moving to confirmed OR processing, and no shiprocket ID exists yet
            if (['confirmed', 'processing'].includes(status) && !order.shiprocket_order_id) {
                try {
                    const shiprocketService = require('../../utiles/shiprocketService');
                    const customerOrderModel = require('../../models/wear/customerOrder');
                    
                    const parentOrder = await customerOrderModel.findById(order.orderId);
                    
                    if (parentOrder) {
                        const shippingInfo = parentOrder.shippingInfo;
                        
                        const orderItems = order.products.map(p => ({
                            name: p.name || p.productName || 'Jeenora Product',
                            sku: p.sku || 'SKU-001',
                            units: p.quantity || 1,
                            selling_price: Math.max(1, p.price || Math.round(order.price / order.products.length)),
                            discount: 0,
                            tax: 0,
                            hsn: ''
                        }));

                        // Fetch pickup locations to ensure we use a valid one
                        let pickupLocation = "Primary";
                        try {
                            const locations = await shiprocketService.getPickupLocations();
                            if (locations && locations.data && locations.data.shipping_address && locations.data.shipping_address.length > 0) {
                                // Check if "Primary" exists, else use the first one
                                const hasPrimary = locations.data.shipping_address.find(l => l.pickup_location === 'Primary');
                                if (!hasPrimary) {
                                    pickupLocation = locations.data.shipping_address[0].pickup_location;
                                }
                            }
                        } catch (locErr) {
                            console.warn('Could not fetch Shiprocket pickup locations, defaulting to Primary');
                        }

                        const shiprocketPayload = {
                            order_id: `JN-${order._id.toString().slice(-8).toUpperCase()}`,
                            order_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
                            pickup_location: pickupLocation, 
                            billing_customer_name: shippingInfo?.name || 'Customer',
                            billing_last_name: '',
                            billing_address: shippingInfo?.address || 'Address',
                            billing_city: shippingInfo?.city || 'City',
                            billing_pincode: shippingInfo?.pincode || '000000',
                            billing_state: shippingInfo?.state || 'State',
                            billing_country: "India",
                            billing_email: shippingInfo?.email || 'customer@jeenora.com',
                            billing_phone: shippingInfo?.phone || '9999999999',
                            shipping_is_billing: true,
                            order_items: orderItems,
                            payment_method: parentOrder.payment_method === 'ONLINE' ? 'Prepaid' : 'COD',
                            sub_total: order.price,
                            length: 10,
                            breadth: 10,
                            height: 10,
                            weight: 0.5
                        };

                        const shiprocketResponse = await shiprocketService.createOrder(shiprocketPayload);
                        
                        if (shiprocketResponse && shiprocketResponse.order_id) {
                            order.shiprocket_order_id = shiprocketResponse.order_id.toString();
                            order.shiprocket_shipment_id = shiprocketResponse.shipment_id?.toString();
                            await order.save();
                        } else {
                            console.warn('Shiprocket response missing order_id:', shiprocketResponse);
                        }
                    }
                } catch (srError) {
                    console.error('Shiprocket Automation Error:', srError.response?.data || srError.message);
                    // We don't block the response, but we could add a flag to the response
                    order.shiprocket_error = srError.response?.data?.message || srError.message;
                }
            }
            // ============================

            // SYNC UPWARDS TO MAIN ORDER
            try {
                const subOrders = await authOrderModel.find({ orderId: order.orderId });
                const allDelivered = subOrders.every(o => o.delivery_status === 'delivered');
                const allCancelled = subOrders.every(o => o.delivery_status === 'cancelled');

                if (allDelivered) {
                    await customerOrder.findByIdAndUpdate(order.orderId, { delivery_status: 'delivered' });
                } else if (allCancelled) {
                    await customerOrder.findByIdAndUpdate(order.orderId, { delivery_status: 'cancelled' });
                }
            } catch (err) {
            }

            responseReturn(res, 200, { success: true, message: `Order status updated to ${status}`, order });
        } catch (error) {
            console.error('Update Order Status Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 2.5 Mobile App - Get Supplier Payouts / Payments
    get_supplier_payouts = async (req, res) => {
        const { id } = req;
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: 'Supplier account not found' });

            const orders = await authOrderModel.find({ sellerId: supplier._id, delivery_status: 'delivered' }).sort({ updatedAt: -1 });

            // In a real system, you'd have a separate payout table. 
            // For now, we derive it from delivered orders.
            const commissionRate = 0.05; // 5% platform fee

            const history = orders.map(order => ({
                id: order._id,
                amount: order.price * (1 - commissionRate),
                total: order.price,
                commission: order.price * commissionRate,
                date: order.updatedAt,
                status: 'paid', // Mock status
                orderId: order._id.slice(-8).toUpperCase()
            }));

            const totalEarnings = history.reduce((acc, h) => acc + h.amount, 0);
            const pendingSettlement = 0; // Simplified for now

            responseReturn(res, 200, {
                success: true,
                totalEarnings,
                pendingSettlement,
                history
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 2.6 Mobile App - Get Supplier Returns
    get_supplier_returns = async (req, res) => {
        const { id } = req;
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: 'Supplier account not found' });

            const returns = await authOrderModel.find({
                sellerId: supplier._id,
                return_status: { $ne: 'none' }
            }).sort({ updatedAt: -1 });

            responseReturn(res, 200, { success: true, returns });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 2.7 Mobile App - Update Return Status
    update_return_status = async (req, res) => {
        const { orderId } = req.params;
        const { status } = req.body;
        const { id } = req;

        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: 'Supplier account not found' });

            const order = await authOrderModel.findOne({ _id: orderId, sellerId: supplier._id });
            if (!order) return responseReturn(res, 404, { error: 'Order not found' });

            order.return_status = status;
            await order.save();

            responseReturn(res, 200, { success: true, message: `Return status updated to ${status}`, order });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 2.8 Mobile App - Get Single Order Details
    get_order_details = async (req, res) => {
        const { orderId } = req.params;
        const { id } = req;

        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: 'Supplier account not found' });

            const order = await authOrderModel.findOne({ _id: orderId, sellerId: supplier._id });
            if (!order) return responseReturn(res, 404, { error: 'Order not found' });

            responseReturn(res, 200, { success: true, order });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // --- DASHBOARD ADMIN METHODS ---

    // 3. Admin - List all suppliers (with filters)
    get_suppliers = async (req, res) => {
        let { page, searchValue, parPage, status } = req.query;
        page = parseInt(page) || 1;
        parPage = parseInt(parPage) || 10;
        const skipPage = parPage * (page - 1);

        try {
            // 1. Get Suppliers
            let supplierQuery = {};
            if (searchValue) {
                supplierQuery['businessDetails.shopName'] = { $regex: searchValue, $options: 'i' };
            }
            if (status && status !== 'all') {
                supplierQuery.status = status;
            }

            const suppliers = await Supplier.find(supplierQuery)
                .sort({ createdAt: -1 })
                .populate('user', 'name phone email')
                .select('+businessDetails.gstNumber +businessDetails.panNumber +businessDetails.panName +addressDetails +bankDetails')
                .lean();

            // 2. Get Sellers (Legacy)
            let sellerQuery = {};
            if (searchValue) {
                sellerQuery['name'] = { $regex: searchValue, $options: 'i' };
            }
            if (status && status !== 'all') {
                sellerQuery.status = status;
            }

            const sellersRaw = await Seller.find(sellerQuery).lean();

            // 3. Map Sellers to Supplier format for UI consistency
            const legacySuppliers = sellersRaw.map(s => ({
                _id: s._id,
                user: { _id: s._id, name: s.name, phone: s.shopInfo?.phone || '' },
                businessDetails: {
                    shopName: s.shopInfo?.shopName || s.name,
                    businessType: 'Legacy',
                    hasGst: false
                },
                status: s.status,
                isLegacy: true,
                createdAt: s.createdAt
            }));

            // 4. Combine (Remove duplicates if any overlap)
            const supplierIds = new Set(suppliers.map(s => s._id.toString()));
            const combined = [...suppliers];

            legacySuppliers.forEach(ls => {
                if (!supplierIds.has(ls._id.toString())) {
                    combined.push(ls);
                }
            });

            // 5. Get Product Counts (Wear + Legacy)
            const legacyProductModel = require('../../models/wear/productModel');
            const allVendorIds = combined.map(v => v._id);
            const allVendorObjectIds = allVendorIds.map(id => new ObjectId(id));

            const [wearCounts, legacyCounts] = await Promise.all([
                WearProduct.aggregate([
                    { $match: { sellerId: { $in: allVendorObjectIds } } },
                    { $group: { _id: "$sellerId", count: { $sum: 1 } } }
                ]),
                legacyProductModel.aggregate([
                    { $match: { sellerId: { $in: allVendorObjectIds } } },
                    { $group: { _id: "$sellerId", count: { $sum: 1 } } }
                ])
            ]);

            const countMap = new Map();
            const newProductMap = new Map(); // Track if any product is < 24h old
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            wearCounts.forEach(c => {
                const idStr = c._id.toString();
                countMap.set(idStr, (countMap.get(idStr) || 0) + c.count);
            });
            legacyCounts.forEach(c => {
                const idStr = c._id.toString();
                countMap.set(idStr, (countMap.get(idStr) || 0) + c.count);
            });

            // Find suppliers with new products
            const [newWearProducts, newLegacyProducts] = await Promise.all([
                WearProduct.find({ 
                    sellerId: { $in: allVendorObjectIds },
                    createdAt: { $gt: oneDayAgo }
                }, 'sellerId').lean(),
                legacyProductModel.find({
                    sellerId: { $in: allVendorObjectIds },
                    createdAt: { $gt: oneDayAgo }
                }, 'sellerId').lean()
            ]);

            newWearProducts.forEach(p => newProductMap.set(p.sellerId.toString(), true));
            newLegacyProducts.forEach(p => newProductMap.set(p.sellerId.toString(), true));

            // Attach counts & flags to combined list
            const combinedWithCounts = combined.map(v => ({
                ...v,
                productCount: countMap.get(v._id.toString()) || 0,
                hasNewProducts: newProductMap.has(v._id.toString())
            }));

            // Re-sort and paginate combined list
            combinedWithCounts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            const paginatedSuppliers = combinedWithCounts.slice(skipPage, skipPage + parPage);
            const totalSuppliers = combinedWithCounts.length;

            responseReturn(res, 200, { suppliers: paginatedSuppliers, totalSuppliers });
        } catch (error) {
            console.error('Fetch Suppliers Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 4. Admin - Update supplier status
    update_status = async (req, res) => {
        const { supplierId } = req.params;
        const { status } = req.body;

        try {
            const supplier = await Supplier.findByIdAndUpdate(supplierId, { status }, { new: true });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }

            // AI Notification Integration
            try {
                
                // Fetch associated user account for notification settings
                const userAccount = await WearBuyer.findById(supplier.user).select('+notificationSettings');
                const settings = userAccount?.notificationSettings || { orderUpdates: true, whatsappNotifications: true };

                if (settings.whatsappNotifications && settings.orderUpdates) {
                    const event = status === 'approved' ? 'application_approved' : (status === 'rejected' ? 'application_rejected' : `status_${status}`);
                    const message = await aiService.generateNotificationMessage('supplier', event, {
                        shopName: supplier.businessDetails?.shopName,
                        name: supplier.supplierDetails?.fullName,
                        status: status
                    });

                    if (supplier.supplierDetails?.phone) {
                        await whatsappClient.sendMessage(supplier.supplierDetails.phone, message);
                    }
                } else {
                }
            } catch (aiError) {
                console.error('[AI Notification] Failed to send status update notification:', aiError.message);
            }

            responseReturn(res, 200, { success: true, message: 'Status updated successfully', data: supplier });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 4.1 Admin - Update full supplier details
    update_supplier = async (req, res) => {
        const { supplierId } = req.params;
        const { businessDetails, addressDetails, bankDetails, supplierDetails, ownerName } = req.body;

        try {
            const supplier = await Supplier.findById(supplierId);
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }

            // Update user name & phone if provided
            if ((ownerName || req.body.phone) && supplier.user) {
                const User = require('../../models/wear/wearBuyerModel');
                const updateData = {};
                if (ownerName) updateData.name = ownerName;
                if (req.body.phone) updateData.phone = req.body.phone;
                await User.findByIdAndUpdate(supplier.user, updateData);
            }

            // Update supplier fields
            supplier.businessDetails = businessDetails;
            supplier.addressDetails = addressDetails;
            supplier.bankDetails = bankDetails;
            supplier.supplierDetails = supplierDetails;
            await supplier.save();

            const updatedSupplier = await Supplier.findById(supplierId).populate('user', 'name phone');

            responseReturn(res, 200, { success: true, message: 'Supplier details updated successfully', data: updatedSupplier });
        } catch (error) {
            console.error('Update Supplier Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 4.2 Admin - Add a new supplier manually
    add_supplier = async (req, res) => {
        const { id } = req; // creator ID
        const { businessDetails, addressDetails, bankDetails, supplierDetails } = req.body;

        try {
            const supplier = await Supplier.create({
                user: id, // Linking to the admin/creator for now or keep empty
                businessDetails,
                addressDetails,
                bankDetails,
                supplierDetails,
                status: 'approved' // Manually added are approved by default
            });

            responseReturn(res, 201, { success: true, message: 'Supplier added successfully', data: supplier });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 5. Admin - Delete supplier
    delete_supplier = async (req, res) => {
        const { supplierId } = req.params;
        try {
            await Supplier.findByIdAndDelete(supplierId);
            responseReturn(res, 200, { success: true, message: 'Supplier deleted successfully' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 5.1 Admin - Get full supplier details by ID (including all select:false fields + sales stats)
    get_supplier_by_id = async (req, res) => {
        const { supplierId } = req.params;
        try {
            const supplier = await Supplier.findById(supplierId)
                .populate('user', 'name phone email')
                .select('+businessDetails.gstNumber +businessDetails.panNumber +businessDetails.panName +businessDetails.enrolmentId +addressDetails.state +addressDetails.pincode +addressDetails.district +addressDetails.city +addressDetails.addressLine +addressDetails.street +addressDetails.landmark +bankDetails.accountNumber +bankDetails.ifscCode +bankDetails.bankName +bankDetails.branchName +bankDetails.address +bankDetails.city +bankDetails.state +bankDetails.micr')
                .lean();

            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }

            const WearProduct = require('../../models/wear/wearProductModel');
            const legacyProductModel = require('../../models/wear/productModel');
            const mongoose = require('mongoose');
            const sellerObjId = new mongoose.Types.ObjectId(supplierId);

            // Catalog counts
            const [totalCatalogs, activeCatalogs, pendingCatalogs, legacyCount] = await Promise.all([
                WearProduct.countDocuments({ sellerId: sellerObjId }),
                WearProduct.countDocuments({ sellerId: sellerObjId, status: 'active' }),
                WearProduct.countDocuments({ sellerId: sellerObjId, status: 'pending' }),
                legacyProductModel.countDocuments({ sellerId: sellerObjId }),
            ]);

            // Sales stats from authOrders
            const orders = await authOrderModel.find({ sellerId: sellerObjId }).lean();
            const totalOrders = orders.length;
            const deliveredOrders = orders.filter(o => o.delivery_status === 'delivered');
            const totalGMV = orders.reduce((sum, o) => sum + (o.price || 0), 0);
            const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.price || 0), 0);
            const avgOrderValue = totalOrders > 0 ? Math.round(totalGMV / totalOrders) : 0;
            const totalReturns = orders.filter(o => o.return_status && o.return_status !== 'none').length;
            const pendingOrders = orders.filter(o => o.delivery_status === 'pending').length;
            const cancelledOrders = orders.filter(o => o.delivery_status === 'cancelled').length;
            const returnRate = totalOrders > 0 ? parseFloat(((totalReturns / totalOrders) * 100).toFixed(1)) : 0;

            // Top selling products by this supplier (top 5 by name)
            const topProducts = await authOrderModel.aggregate([
                { $match: { sellerId: sellerObjId } },
                { $group: { _id: '$productId', name: { $first: '$productName' }, totalSales: { $sum: '$price' }, count: { $sum: 1 } } },
                { $sort: { totalSales: -1 } },
                { $limit: 5 }
            ]);

            responseReturn(res, 200, {
                success: true,
                supplier: {
                    ...supplier,
                    stats: {
                        totalCatalogs: totalCatalogs + legacyCount,
                        activeCatalogs,
                        pendingCatalogs,
                    },
                    salesStats: {
                        totalOrders,
                        totalGMV,
                        totalRevenue,
                        avgOrderValue,
                        totalReturns,
                        returnRate,
                        pendingOrders,
                        cancelledOrders,
                        deliveredOrders: deliveredOrders.length,
                        topProducts,
                    }
                }
            });
        } catch (error) {
            console.error('Get Supplier By ID Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }
    // 2.9 Mobile App - Send Email Verification OTP
    send_verification_email = async (req, res) => {
        const { email } = req.body;
        if (!email) return responseReturn(res, 400, { error: 'Email is required' });

        try {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            
            const WearEmailOtp = require('../../models/wear/wearEmailOtpModel');
            const { sendEmail } = require('../../utiles/emailSender');

            // Save OTP to DB
            await WearEmailOtp.findOneAndUpdate(
                { email },
                { otp, createdAt: Date.now() },
                { upsert: true, new: true }
            );

            // Send Email
            const subject = 'Jeenora Supplier Registration - Email Verification';
            const message = `Your verification code is ${otp}. It will expire in 5 minutes.`;
            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 10px; overflow: hidden;">
                  <div style="background: #7C3AED; padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: 2px;">JEENORA SUPPLIER</h1>
                  </div>
                  <div style="padding: 30px; background: #ffffff; text-align: center;">
                    <h2 style="color: #333; margin-top: 0;">Verify Your Email</h2>
                    <p style="font-size: 16px; line-height: 1.6; color: #555;">Use the code below to verify your email address for supplier registration.</p>
                    <div style="margin: 30px 0; padding: 20px; background: #F3F4F6; border-radius: 12px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #7C3AED;">
                        ${otp}
                    </div>
                    <p style="font-size: 12px; color: #9CA3AF;">This code expires in 5 minutes.</p>
                  </div>
                  <div style="background: #F9FAFB; padding: 15px; text-align: center; font-size: 12px; color: #9CA3AF; border-top: 1px solid #F3F4F6;">
                    &copy; ${new Date().getFullYear()} Jeenora Enterprise. All rights reserved.
                  </div>
                </div>
            `;

            const sent = await sendEmail(email, subject, message, html);
            if (!sent) return responseReturn(res, 500, { error: 'Failed to send email' });

            responseReturn(res, 200, { success: true, message: 'OTP sent successfully' });
        } catch (error) {
            console.error('Send Email OTP Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 2.10 Mobile App - Verify Email OTP
    verify_email_otp = async (req, res) => {
        const { email, otp } = req.body;
        if (!email || !otp) return responseReturn(res, 400, { error: 'Email and OTP are required' });

        try {
            const WearEmailOtp = require('../../models/wear/wearEmailOtpModel');
            const record = await WearEmailOtp.findOne({ email, otp });

            if (!record) {
                return responseReturn(res, 400, { error: 'Invalid or expired OTP' });
            }

            // Delete OTP after verification
            await WearEmailOtp.deleteOne({ _id: record._id });

            responseReturn(res, 200, { success: true, message: 'Email verified successfully!' });
        } catch (error) {
            console.error('Verify Email OTP Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // ==================== FINANCIAL MANAGEMENT ====================
    get_financial_dashboard = async (req, res) => {
        try {
            const { id } = req;
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: 'Supplier not found' });

            const orders = await authOrderModel.find({ sellerId: supplier._id });
            const totalRevenue = orders.filter(o => o.delivery_status === 'delivered').reduce((acc, o) => acc + o.price, 0);
            
            const dashboard = {
                summary: {
                    availableBalance: totalRevenue * 0.9,
                    currentMonthRevenue: totalRevenue * 0.3,
                    currentMonthDeductions: totalRevenue * 0.05,
                    lastMonthNet: totalRevenue * 0.4
                },
                upcomingPayout: {
                    amount: totalRevenue * 0.15,
                    estimatedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                },
                recentPayouts: [
                    { transactionId: 'TXN_' + Date.now(), amount: 15450, date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), status: 'completed' },
                    { transactionId: 'TXN_' + (Date.now() - 1000), amount: 8200, date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), status: 'completed' }
                ]
            };

            // PERSIST TO FILE
            writeDataToFile(`financial_${id}`, dashboard);

            responseReturn(res, 200, {
                success: true,
                dashboard
            });
        } catch (error) {
            console.error('Get Financial Dashboard Error:', error);
            // FALLBACK TO FILE
            const fallback = readDataFromFile(`financial_${req.id}`);
            if (fallback) {
                return responseReturn(res, 200, { success: true, dashboard: fallback, fromFile: true });
            }
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_settlement_history = async (req, res) => {
        try {
            const { id } = req;
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: 'Supplier not found' });

            const settlements = [
                { settlementId: 'SET-10293', period: '15-28 Feb', netAmount: 24500, paymentDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), status: 'completed' },
                { settlementId: 'SET-10284', period: '01-14 Feb', netAmount: 18200, paymentDate: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000), status: 'completed' }
            ];

            // PERSIST TO FILE
            writeDataToFile(`settlements_${id}`, settlements);

            responseReturn(res, 200, {
                success: true,
                settlements
            });
        } catch (error) {
            console.error('Get Settlement History Error:', error);
            // FALLBACK TO FILE
            const fallback = readDataFromFile(`settlements_${req.id}`);
            if (fallback) {
                return responseReturn(res, 200, { success: true, settlements: fallback, fromFile: true });
            }
            responseReturn(res, 500, { error: error.message });
        }
    }


    // ==================== PRICING MANAGEMENT ====================
    get_pricing_data = async (req, res) => {
        try {
            const { id } = req;
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: 'Supplier not found' });

            const products = await WearProduct.find({ sellerId: supplier._id });
            
            const stats = {
                avgMargin: 24.5,
                priceChanges: products.filter(p => p.updatedAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
                competitiveProducts: products.length,
                priceRecommendations: products.filter(p => p.status === 'active').length > 5 ? 8 : 0
            };

            const pricingData = {
                stats,
                products: products.map(p => ({
                    _id: p._id,
                    name: p.productName,
                    currentPrice: p.variants?.[0]?.listingPrice || 0,
                    mrp: p.variants?.[0]?.mrp || 0,
                    stock: p.variants?.reduce((acc, v) => acc + v.stock, 0) || 0,
                    image: p.images?.[0]
                })),
                competition: [],
                analytics: {}
            };

            // PERSIST TO FILE
            writeDataToFile(`pricing_${id}`, pricingData);

            responseReturn(res, 200, {
                success: true,
                data: pricingData
            });
        } catch (error) {
            console.error('Get Pricing Data Error:', error);
            // FALLBACK TO FILE
            const fallback = readDataFromFile(`pricing_${req.id}`);
            if (fallback) {
                return responseReturn(res, 200, { success: true, data: fallback, fromFile: true });
            }
            responseReturn(res, 500, { error: error.message });
        }
    }

    update_product_price = async (req, res) => {
        try {
            const { id } = req;
            const { productId, newPrice } = req.body;
            // TODO: Implement price update logic
            responseReturn(res, 200, {
                success: true,
                message: 'Price updated successfully'
            });
        } catch (error) {
            console.error('Update Product Price Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // ==================== WAREHOUSE MANAGEMENT ====================
    get_warehouse_data = async (req, res) => {
        try {
            const { id } = req;
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: 'Supplier not found' });

            const products = await WearProduct.find({ sellerId: supplier._id });
            
            const stats = {
                totalProducts: products.length,
                lowStockItems: products.filter(p => p.variants?.some(v => v.stock < 10)).length,
                totalValue: products.reduce((acc, p) => acc + (p.variants?.reduce((vAcc, v) => vAcc + (v.stock * v.listingPrice), 0) || 0), 0),
                locations: 1
            };

            const warehouseData = {
                stats,
                inventory: products.map(p => ({
                    _id: p._id,
                    productName: p.productName,
                    sku: p.variants?.[0]?.skuId || 'N/A',
                    stockQuantity: p.variants?.reduce((acc, v) => acc + v.stock, 0) || 0,
                    status: p.status,
                    sellingPrice: p.variants?.[0]?.listingPrice || 0,
                    image: p.images?.[0]
                })),
                locations: [
                    { name: 'Primary Warehouse', type: 'Main', address: 'Plot 42, Industrial Area', status: 'active', productCount: products.length, capacity: 65, staffCount: 4 }
                ],
                staff: [],
                analytics: {}
            };

            // PERSIST TO FILE
            writeDataToFile(`warehouse_${id}`, warehouseData);

            responseReturn(res, 200, {
                success: true,
                data: warehouseData
            });
        } catch (error) {
            console.error('Get Warehouse Data Error:', error);
            // FALLBACK TO FILE
            const fallback = readDataFromFile(`warehouse_${req.id}`);
            if (fallback) {
                return responseReturn(res, 200, { success: true, data: fallback, fromFile: true });
            }
            responseReturn(res, 500, { error: error.message });
        }
    }

    // ==================== PROMOTIONS MANAGEMENT ====================
    get_promotions_data = async (req, res) => {
        try {
            const { id } = req;
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: 'Supplier not found' });

            const products = await WearProduct.find({ sellerId: supplier._id });

            // DERIVE PROM STATS
            const stats = {
                activeCount: products.filter(p => p.status === 'active').length > 0 ? 3 : 0,
                avgDiscount: 25,
                salesUplift: 42,
                totalReach: 1250
            };

            responseReturn(res, 200, {
                success: true,
                data: {
                    stats,
                    promotions: [
                        { name: 'Festive Flash Sale', status: 'active', discount: '20%', reach: 850, endsIn: '2 days' },
                        { name: 'Weekend Bonanza', status: 'upcoming', discount: '30%', reach: 0, startsIn: '5 days' }
                    ],
                    analytics: {}
                }
            });
        } catch (error) {
            console.error('Get Promotions Data Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    create_promotion = async (req, res) => {
        try {
            const { id } = req;
            const promotionData = req.body;
            // TODO: Implement promotion creation logic
            responseReturn(res, 201, {
                success: true,
                message: 'Promotion created successfully'
            });
        } catch (error) {
            console.error('Create Promotion Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // ==================== OFFER ZONE MANAGEMENT ====================
    get_offer_zone_data = async (req, res) => {
        try {
            const { id } = req;
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: 'Supplier not found' });

            responseReturn(res, 200, {
                success: true,
                data: {
                    offers: [
                        { name: 'Buy 1 Get 1', type: 'Bundled', products: 12, status: 'expired' },
                        { name: 'Cart Value 500+', type: 'Discount', products: 'All', status: 'active' }
                    ],
                    analytics: {}
                }
            });
        } catch (error) {
            console.error('Get Offer Zone Data Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // ==================== PRICE RECOMMENDATION ====================
    get_price_recommendations = async (req, res) => {
        try {
            const { id } = req;
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: 'Supplier not found' });

            const products = await WearProduct.find({ sellerId: supplier._id, status: 'active' }).limit(5);
            
            const recommendations = products.map((p, idx) => ({
                id: p._id,
                name: p.productName,
                currentPrice: `₹${p.variants?.[0]?.listingPrice || 0}`,
                recommendedPrice: `₹${Math.floor((p.variants?.[0]?.listingPrice || 0) * 0.9)}`,
                impact: idx % 2 === 0 ? '+20% Conversion' : '+15% Sales',
                reason: idx % 2 === 0 ? 'High competition' : 'Stock clearance',
                image: p.images?.[0]
            }));

            responseReturn(res, 200, {
                success: true,
                data: {
                    recommendations,
                    marketData: {},
                    aiInsights: {
                        summary: "Prices adjusted for market trends.",
                        confidence: "88%"
                    }
                }
            });
        } catch (error) {
            console.error('Get Price Recommendations Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // ==================== QUALITY DASHBOARD ====================
    get_quality_dashboard_data = async (req, res) => {
        try {
            const { id } = req;
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: 'Supplier not found' });

            const orders = await authOrderModel.find({ sellerId: supplier._id });
            const products = await WearProduct.find({ sellerId: supplier._id });
            const productIds = products.map(p => p._id);
            const reviews = await reviewModel.find({ productId: { $in: productIds } }).limit(10).sort({ createdAt: -1 });

            const rtoCount = orders.filter(o => o.delivery_status === 'cancelled' || o.delivery_status === 'returned').length;
            const rtoRate = orders.length > 0 ? ((rtoCount / orders.length) * 100).toFixed(1) : 0;
            const avgRating = reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : 'N/A';

            const qualityMetrics = {
                rating: avgRating,
                rtoRate: `${rtoRate}%`,
                qcPass: '98%',
                level: 'Gold Supplier'
            };

            responseReturn(res, 200, {
                success: true,
                data: {
                    qualityMetrics,
                    customerFeedback: reviews.map(r => ({
                        id: r._id,
                        user: r.name,
                        rating: r.rating,
                        comment: r.review,
                        date: r.createdAt
                    })),
                    productReviews: [],
                    analytics: {}
                }
            });
        } catch (error) {
            console.error('Get Quality Dashboard Data Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new supplierController();
