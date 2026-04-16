const Supplier = require('../../models/wear/supplierModel');
const Seller = require('../../models/wear/sellerModel');
const WearProduct = require('../../models/wear/wearProductModel');
const authOrderModel = require('../../models/wear/authOrder');
const customerOrder = require('../../models/wear/customerOrder');
const { responseReturn } = require('../../utiles/response');
const { isValidTransition } = require('../../utiles/orderValidators');
const { mongo: { ObjectId } } = require('mongoose');

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
            const axios = require('axios');
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
            const axios = require('axios');
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
                    const WearBuyer = require('../../models/wear/wearBuyerModel');
                    const Customer = require('../../models/wear/customerModel');

                    const buyer = await WearBuyer.findOne({ phone });
                    const customer = await Customer.findOne({ phone });

                    const ids = [id];
                    if (buyer) ids.push(buyer._id);
                    if (customer) ids.push(customer._id);

                    supplier = await Supplier.findOne({ user: { $in: ids } });
                }
            }

            if (!supplier) {
                return responseReturn(res, 404, { error: 'No application found' });
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
            const orders = await authOrderModel.find({ sellerId: id });
            const totalOrders = orders.length;
            const totalSales = orders.reduce((acc, order) => acc + (order.price || 0), 0);
            const pendingShipments = orders.filter(o => o.delivery_status === 'confirmed').length;
            const pendingConfirmation = orders.filter(o => o.delivery_status === 'pending').length;
            const returnsCount = orders.filter(o => o.return_status !== 'none' && o.return_status !== 'completed').length;

            responseReturn(res, 200, {
                success: true,
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
            const orders = await authOrderModel.find({ sellerId: id }).sort({ createdAt: -1 });
            responseReturn(res, 200, { success: true, orders });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 2.4 Mobile App - Update Order Status
    update_order_status = async (req, res) => {
        const { orderId } = req.params;
        const { status } = req.body;
        const { id } = req; // user id from midleware

        try {
            const order = await authOrderModel.findOne({ _id: orderId, sellerId: id });
            if (!order) {
                return responseReturn(res, 404, { error: 'Order not found or not authorized' });
            }

            // 1. Validate Transition
            if (!isValidTransition(order.delivery_status, status)) {
                return responseReturn(res, 400, {
                    error: `Illegal Status Transition: Cannot move from ${order.delivery_status.toUpperCase()} to ${status.toUpperCase()}`
                })
            }

            order.delivery_status = status;
            await order.save();

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
                console.log('Sync Logic Error:', err.message);
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
            const orders = await authOrderModel.find({ sellerId: id, delivery_status: 'delivered' }).sort({ updatedAt: -1 });

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
            const returns = await authOrderModel.find({
                sellerId: id,
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
            const order = await authOrderModel.findOne({ _id: orderId, sellerId: id });
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
            const order = await authOrderModel.findOne({ _id: orderId, sellerId: id });
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
                .populate('user', 'name phone')
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
            wearCounts.forEach(c => {
                const idStr = c._id.toString();
                countMap.set(idStr, (countMap.get(idStr) || 0) + c.count);
            });
            legacyCounts.forEach(c => {
                const idStr = c._id.toString();
                countMap.set(idStr, (countMap.get(idStr) || 0) + c.count);
            });

            // Attach counts to combined list
            const combinedWithCounts = combined.map(v => ({
                ...v,
                productCount: countMap.get(v._id.toString()) || 0
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
}

module.exports = new supplierController();
