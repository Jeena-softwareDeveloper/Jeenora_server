const orderController = require('../../controllers/customer/orderController')

const { authMiddleware } = require('../../middlewares/authMiddleware')
const router = require('express').Router()


//CUSTOMER

router.post('/home/order/place-order', orderController.place_order)
router.get('/home/customer/get-dashboard-data/:userId', orderController.get_customer_dashboard_data)
router.get('/home/customer/get-orders/:customerId/:status', orderController.get_orders)
router.get('/home/customer/get-order-details/:orderId', orderController.get_order_details)
router.put('/home/customer/order-cancel/:orderId', orderController.customer_order_cancel)
router.put('/home/customer/order-fail/:orderId', orderController.customer_order_fail)
router.get('/admin/order/:orderId', orderController.get_admin_order)
router.post('/order/cashfree-create-order', orderController.create_cashfree_order)
router.post('/order/cashfree-verify', orderController.verify_cashfree_payment)
router.get('/order/confirm/:orderId', orderController.order_confirm)
router.get('/order/rto-risk/:mobile', orderController.check_rto_risk)
router.get('/order/shipping-rate/:pincode', orderController.get_dynamic_shipping_rate)
router.post('/webhook/shiprocket', orderController.shiprocket_webhook)
//ADMIN

router.get('/admin/orders', orderController.get_admin_orders)
router.put('/admin/order-status/update/:orderId', orderController.admin_order_status_update)

//ADMIN-USER (PARTNER)
router.get('/admin-user/orders/:partnerId', authMiddleware, orderController.get_partner_orders)
router.get('/admin-user/order/:orderId', authMiddleware, orderController.get_partner_order)
router.put('/admin-user/order-status/update/:orderId', authMiddleware, orderController.partner_order_status_update)

//PARTNER
router.get('/partner/orders/:partnerId', orderController.get_partner_orders)
router.get('/partner/order/:orderId', orderController.get_partner_order)
router.put('/partner/order-status/update/:orderId', orderController.partner_order_status_update)

// AUTRE
router.put('/product/:productId/decrease-stock', orderController.decrease_stock)
router.put('/product/:productId/increase-stock', orderController.increase_stock)

module.exports = router