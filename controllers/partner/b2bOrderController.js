const authOrderModel = require('../../models/partner/AuthOrder');
const customerOrder = require('../../models/customer/customerOrder');
const customerModel = require('../../models/customer/Customer');
const moment = require('moment');
const { B2B_STATUS, isValidB2BTransition } = require('../../utils/orderValidators');
const { responseReturn } = require('../../utils/response');
const { mongo: { ObjectId } } = require('mongoose');

const REJECTION_REASONS = {
    'OUT_OF_STOCK': 'Requested items are currently out of stock',
    'PRICING_ERROR': 'Product pricing needs to be updated',
    'UNABLE_TO_FULFILL': 'Unable to fulfill this order at this time',
    'LOGISTICS_ISSUE': 'Cannot ship to the given pincode',
    'OTHER': 'Other reason'
};

class B2BOrderController {

    // ── PARTNER: Accept Order ──────────────────────────────────────────────
    accept_order = async (req, res) => {
        try {
            const partnerId = req.id;
            const { orderId } = req.params;

            const order = await authOrderModel.findOne({ _id: orderId, partnerId });
            if (!order) {
                return responseReturn(res, 404, { error: 'Order not found' });
            }

            if (order.order_type !== 'B2B') {
                return responseReturn(res, 400, { error: 'Not a B2B order' });
            }

            if (!isValidB2BTransition(order.b2b_status, B2B_STATUS.ACCEPTED)) {
                return responseReturn(res, 400, {
                    error: `Cannot accept order in current status: ${order.b2b_status}`
                });
            }

            // Check if deadline has passed
            if (order.acceptDeadline && new Date() > order.acceptDeadline) {
                // Auto-cancel the order
                order.b2b_status = 'cancelled';
                order.autoCancelled = true;
                order.cancelled_at = new Date();
                order.cancel_reason = 'Auto-cancelled: Partner did not accept within 48 hours';
                await order.save();

                return responseReturn(res, 400, {
                    error: 'Acceptance deadline has passed. Order has been auto-cancelled.',
                    autoCancelled: true
                });
            }

            order.b2b_status = 'accepted';
            order.accepted_at = new Date();
            order.delivery_status = 'confirmed';
            await order.save();

            return responseReturn(res, 200, {
                success: true,
                message: 'Order accepted successfully',
                order: {
                    _id: order._id,
                    b2b_status: order.b2b_status,
                    accepted_at: order.accepted_at
                }
            });
        } catch (error) {
            console.error('[B2B] Accept error:', error);
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // ── PARTNER: Reject Order ──────────────────────────────────────────────
    reject_order = async (req, res) => {
        try {
            const partnerId = req.id;
            const { orderId } = req.params;
            const { reasonCode, reasonText } = req.body;

            if (!reasonCode || !REJECTION_REASONS[reasonCode]) {
                return responseReturn(res, 400, { error: 'Valid rejection reason code required. Options: ' + Object.keys(REJECTION_REASONS).join(', ') });
            }

            const order = await authOrderModel.findOne({ _id: orderId, partnerId });
            if (!order) {
                return responseReturn(res, 404, { error: 'Order not found' });
            }

            if (order.order_type !== 'B2B') {
                return responseReturn(res, 400, { error: 'Not a B2B order' });
            }

            if (!isValidB2BTransition(order.b2b_status, B2B_STATUS.REJECTED)) {
                return responseReturn(res, 400, {
                    error: `Cannot reject order in current status: ${order.b2b_status}`
                });
            }

            order.b2b_status = 'rejected';
            order.rejection_reason_code = reasonCode;
            order.rejection_reason_text = reasonText || REJECTION_REASONS[reasonCode];
            order.cancelled_at = new Date();
            order.delivery_status = 'cancelled';

            // If payment was made, trigger refund
            if (order.payment_status === 'Paid' || order.payment_status === 'paid') {
                order.refund_amount = order.price;
                order.payment_status = 'Refunded';
                // TODO: Trigger actual Cashfree refund here
                console.log(`[B2B] 🔄 Refund needed for order ${order._id}: ₹${order.price}`);
            }

            await order.save();

            return responseReturn(res, 200, {
                success: true,
                message: 'Order rejected',
                order: {
                    _id: order._id,
                    b2b_status: order.b2b_status,
                    rejection_reason_code: reasonCode,
                    refund_amount: order.refund_amount
                }
            });
        } catch (error) {
            console.error('[B2B] Reject error:', error);
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // ── PARTNER: Update B2B status (packed → shipped → delivered) ──────────
    update_b2b_status = async (req, res) => {
        try {
            const partnerId = req.id;
            const { orderId } = req.params;
            const { status } = req.body;

            const order = await authOrderModel.findOne({ _id: orderId, partnerId });
            if (!order) {
                return responseReturn(res, 404, { error: 'Order not found' });
            }

            if (order.order_type !== 'B2B') {
                return responseReturn(res, 400, { error: 'Not a B2B order' });
            }

            if (!isValidB2BTransition(order.b2b_status, status)) {
                return responseReturn(res, 400, {
                    error: `Cannot move from ${order.b2b_status} to ${status}`
                });
            }

            order.b2b_status = status;
            order.delivery_status = status === 'shipped' ? 'shipped' : 
                                    status === 'delivered' ? 'delivered' : order.delivery_status;
            await order.save();

            return responseReturn(res, 200, {
                success: true,
                message: `Order status updated to ${status}`,
                order: { _id: order._id, b2b_status: order.b2b_status }
            });
        } catch (error) {
            console.error('[B2B] Status update error:', error);
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // ── PARTNER: Get B2B orders ────────────────────────────────────────────
    get_partner_b2b_orders = async (req, res) => {
        try {
            const partnerId = req.id;
            const { status } = req.query;

            const filter = { partnerId, order_type: 'B2B' };
            if (status && status !== 'all') {
                filter.b2b_status = status;
            }

            const orders = await authOrderModel.find(filter)
                .sort({ createdAt: -1 })
                .lean();

            // Enrich with countdown info
            const now = new Date();
            const enriched = orders.map(o => ({
                ...o,
                acceptDeadlineRemaining: o.acceptDeadline ? Math.max(0, o.acceptDeadline - now) : 0,
                isExpired: o.acceptDeadline ? now > o.acceptDeadline : false,
                products: (o.products || []).map(p => ({
                    ...p,
                    productName: p.productName || p.name || 'Item'
                }))
            }));

            return responseReturn(res, 200, { orders: enriched });
        } catch (error) {
            console.error('[B2B] List error:', error);
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // ── PARTNER: Get B2B order detail ──────────────────────────────────────
    get_partner_b2b_order = async (req, res) => {
        try {
            const partnerId = req.id;
            const { orderId } = req.params;

            const order = await authOrderModel.findOne({ _id: orderId, partnerId, order_type: 'B2B' }).lean();
            if (!order) {
                return responseReturn(res, 404, { error: 'B2B order not found' });
            }

            // Fetch buyer info from main order
            const mainOrder = await customerOrder.findById(order.orderId).lean();
            let buyerInfo = null;
            if (mainOrder) {
                const buyer = await customerModel.findById(mainOrder.customerId).lean();
                if (buyer) {
                    buyerInfo = {
                        name: buyer.name,
                        email: buyer.email,
                        phone: buyer.phone
                    };
                }
            }

            const now = new Date();
            return responseReturn(res, 200, {
                order: {
                    ...order,
                    buyerInfo,
                    acceptDeadlineRemaining: order.acceptDeadline ? Math.max(0, order.acceptDeadline - now) : 0,
                    isExpired: order.acceptDeadline ? now > order.acceptDeadline : false
                }
            });
        } catch (error) {
            console.error('[B2B] Detail error:', error);
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // ── CRON: Auto-cancel expired orders ──────────────────────────────────
    auto_cancel_expired_orders = async () => {
        console.log('[B2B_CRON] Checking for expired orders...');
        try {
            const now = new Date();
            const expiredOrders = await authOrderModel.find({
                order_type: 'B2B',
                b2b_status: 'paid',
                acceptDeadline: { $lte: now },
                autoCancelled: false
            });

            let cancelledCount = 0;
            for (const order of expiredOrders) {
                order.b2b_status = 'cancelled';
                order.autoCancelled = true;
                order.cancelled_at = now;
                order.cancel_reason = 'Auto-cancelled: Partner did not accept within 48 hours';
                order.delivery_status = 'cancelled';

                // Trigger refund if paid
                if (order.payment_status === 'Paid' || order.payment_status === 'paid') {
                    order.refund_amount = order.price;
                    order.payment_status = 'Refunded';
                    // TODO: Actual Cashfree refund API call
                    console.log(`[B2B_CRON] 🔄 Refund needed for order ${order._id}: ₹${order.price}`);
                }

                await order.save();
                cancelledCount++;

                // Notify buyer via main order
                await customerOrder.findByIdAndUpdate(order.orderId, {
                    delivery_status: 'cancelled'
                });

                console.log(`[B2B_CRON] ✅ Auto-cancelled order ${order._id} (48hr deadline passed)`);
            }

            console.log(`[B2B_CRON] ✅ ${cancelledCount} expired orders auto-cancelled.`);
            return cancelledCount;
        } catch (error) {
            console.error('[B2B_CRON] Error:', error.message);
            return 0;
        }
    }

    // ── ADMIN: B2B order stats ────────────────────────────────────────────
    get_admin_b2b_summary = async (req, res) => {
        try {
            const [pending, accepted, shipped, delivered, rejected, autoCancelled] = await Promise.all([
                authOrderModel.countDocuments({ order_type: 'B2B', b2b_status: 'paid' }),
                authOrderModel.countDocuments({ order_type: 'B2B', b2b_status: 'accepted' }),
                authOrderModel.countDocuments({ order_type: 'B2B', b2b_status: 'shipped' }),
                authOrderModel.countDocuments({ order_type: 'B2B', b2b_status: 'delivered' }),
                authOrderModel.countDocuments({ order_type: 'B2B', b2b_status: 'rejected' }),
                authOrderModel.countDocuments({ order_type: 'B2B', autoCancelled: true })
            ]);

            return responseReturn(res, 200, {
                summary: { pending, accepted, shipped, delivered, rejected, autoCancelled, total: pending + accepted + shipped + delivered + rejected + autoCancelled }
            });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // ── REJECTION REASONS (public) ────────────────────────────────────────
    get_rejection_reasons = async (req, res) => {
        return responseReturn(res, 200, { reasons: REJECTION_REASONS });
    }
}

module.exports = new B2BOrderController();