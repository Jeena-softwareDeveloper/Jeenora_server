const router = require('express').Router();
const { authMiddleware, authOptional, adminMiddleware } = require('../middlewares/authMiddleware');
const { otpSendLimiter, otpVerifyLimiter, authLimiter } = require('../middlewares/securityMiddleware');

const configController = require('../controllers/wear/configController');
const authControllers = require('../controllers/wear/standardAuthController');
const googleAuthController = require('../controllers/wear/googleAuthController');
const firebaseAuthController = require('../controllers/wear/firebaseAuthController');
const homeLayoutController = require('../controllers/wear/homeLayoutController');
const productController = require('../controllers/wear/productController');
const homeControllers = require('../controllers/wear/homeControllers');
const cardController = require('../controllers/wear/cardController');
const addressController = require('../controllers/wear/addressController');
const checkoutController = require('../controllers/wear/checkoutController');
const orderController = require('../controllers/wear/orderController');
const profileController = require('../controllers/wear/profileController');
const walletController = require('../controllers/wear/walletController');
const adminWearController = require('../controllers/wear/adminWearController');
const supplierController = require('../controllers/wear/coreSupplierController');
const wearCategoryController = require('../controllers/wear/wearCategoryController');
const wearAuthController = require('../controllers/wear/authController');
const wearCatalogController = require('../controllers/wear/wearCatalogController');
const wearOfferController = require('../controllers/wear/wearOfferController');
const dashboardController = require('../controllers/wear/dashboardController');
const adminSettingsController = require('../controllers/wear/adminSettingsController');
const wearLogController = require('../controllers/wear/wearLogController');
const productOfferController = require('../controllers/wear/productOfferController');
const catalogOffersController = require('../controllers/wear/catalogOffersController');

// --- WEAR SECTION (PRIORITY) ---
router.get('/wear/category/get', wearCategoryController.get_categories);
router.get('/wear/offer/campaign/active', authOptional, wearOfferController.get_active_campaigns);
router.get('/wear/offer/campaign/all', authMiddleware, wearOfferController.get_all_campaigns);
router.post('/wear/offer/campaign/add', authMiddleware, wearOfferController.add_campaign);
router.get('/wear/offer/campaign/:campaignId/participants', authMiddleware, wearOfferController.get_campaign_participants_admin);
router.get('/wear/offer/campaign/:campaignId/participant/:supplierId/products', authMiddleware, wearOfferController.get_supplier_campaign_products_admin);
router.put('/wear/offer/campaign/update/:campaignId', authMiddleware, wearOfferController.update_campaign);
router.delete('/wear/offer/campaign/delete/:campaignId', authMiddleware, wearOfferController.delete_campaign);
router.get('/wear/offer/notification/my', authMiddleware, wearOfferController.get_my_notifications);
router.put('/wear/offer/notification/read/:notifId', authMiddleware, wearOfferController.mark_notification_read);
router.get('/wear/offer/campaign/details/:campaignId', authMiddleware, wearOfferController.get_campaign_details);
router.get('/wear/offer/campaign/participation/:campaignId', authMiddleware, wearOfferController.get_campaign_participation);
router.post('/wear/offer/campaign/add-products', authMiddleware, wearOfferController.add_products_to_campaign);
router.delete('/wear/offer/campaign/remove-product/:productId', authMiddleware, wearOfferController.remove_product_from_campaign);
router.put('/wear/offer/product/update-limited', authMiddleware, wearOfferController.update_product_limited);

// --- PRODUCT DYNAMIC OFFERS ---
router.post('/wear/product-offer/add', authMiddleware, productOfferController.add_offer);
router.get('/wear/product-offer/admin-all', authMiddleware, productOfferController.get_admin_offers);
router.get('/wear/product-offer/active', productOfferController.get_active_offers);
router.put('/wear/product-offer/update/:id', authMiddleware, productOfferController.update_offer);
router.delete('/wear/product-offer/delete/:id', authMiddleware, productOfferController.delete_offer);
router.put('/wear/product-offer/assign-catalog/:productId', authMiddleware, catalogOffersController.update_catalog_offers);

router.post('/wear/auth/send-otp', otpSendLimiter, wearAuthController.send_otp);
router.post('/wear/auth/verify-otp', otpVerifyLimiter, wearAuthController.verify_otp);
router.post('/wear/auth/refresh-token', wearAuthController.refresh_token);
router.get('/wear/auth/profile', authMiddleware, wearAuthController.get_profile);
router.put('/wear/auth/update-profile', authMiddleware, wearAuthController.update_profile);
router.post('/wear/auth/profile-image-upload', authMiddleware, wearAuthController.profile_image_upload);
router.post('/wear/log/log', authOptional, require('../controllers/wear/wearLogController').logActivity);
const wearSupplierController = require('../controllers/wear/supplierController');

// --- WEAR SUPPLIER ---
router.post('/wear/supplier/apply', authMiddleware, wearSupplierController.apply_supplier);
router.get('/wear/supplier/status', authMiddleware, wearSupplierController.get_my_status);
router.get('/wear/supplier/dashboard-stats', authMiddleware, wearSupplierController.get_supplier_dashboard_data);
router.get('/wear/supplier/orders', authMiddleware, wearSupplierController.get_supplier_orders);
router.put('/wear/supplier/order-status/:orderId', authMiddleware, wearSupplierController.update_order_status);
router.get('/wear/supplier/payouts', authMiddleware, wearSupplierController.get_supplier_payouts);
router.get('/wear/supplier/returns', authMiddleware, wearSupplierController.get_supplier_returns);
router.put('/wear/supplier/return-status/:orderId', authMiddleware, wearSupplierController.update_return_status);
router.get('/wear/supplier/order-details/:orderId', authMiddleware, wearSupplierController.get_order_details);
router.get('/wear/supplier/enrolment', authMiddleware, wearSupplierController.get_my_status);
router.post('/wear/supplier/verify-ifsc', authMiddleware, wearSupplierController.verify_ifsc);
router.post('/wear/supplier/verify-bank', authMiddleware, wearSupplierController.verify_bank);
router.post('/wear/supplier/mark-congrats', authMiddleware, wearSupplierController.mark_congrats_shown);

// Catalog Routes
router.get('/wear/supplier/catalog/list', wearCatalogController.get_public_catalogs);
router.post('/wear/supplier/catalog/add', authMiddleware, wearCatalogController.add_catalog);
router.get('/wear/supplier/catalog/my-list', authMiddleware, wearCatalogController.get_my_catalogs);
router.patch('/wear/supplier/catalog/status/:productId', authMiddleware, wearCatalogController.update_catalog_status);
router.put('/wear/supplier/catalog/update/:productId', authMiddleware, wearCatalogController.update_catalog);
router.delete('/wear/supplier/catalog/delete/:productId', authMiddleware, wearCatalogController.delete_catalog);
router.get('/wear/supplier/catalog/all', authMiddleware, wearCatalogController.get_all_catalogs);

// Review Routes
const wearReviewController = require('../controllers/wear/wearReviewController');
router.post('/wear/review/add', authMiddleware, wearReviewController.add_review);
router.get('/wear/review/catalog/:catalogId', wearReviewController.get_catalog_reviews);
router.post('/wear/review/helpful/:reviewId', wearReviewController.mark_helpful);
router.get('/wear/review/admin/all', authMiddleware, wearReviewController.get_all_reviews);
router.put('/wear/review/admin/status/:reviewId', authMiddleware, wearReviewController.update_review_status);
router.delete('/wear/review/admin/delete/:reviewId', authMiddleware, wearReviewController.delete_review);

// --- WEAR BANNERS ---
const wearBannerController = require('../controllers/wear/wearBannerController');
router.post('/wear/banner/add', authMiddleware, wearBannerController.add_banner);
router.get('/wear/banner/all', authMiddleware, wearBannerController.get_all_banners);
router.put('/wear/banner/update/:bannerId', authMiddleware, wearBannerController.update_banner);
router.delete('/wear/banner/delete/:bannerId', authMiddleware, wearBannerController.delete_banner);
router.get('/wear/banner/active', wearBannerController.get_active_banners);
router.get('/wear/banner/category-filters/:categorySlug', authMiddleware, wearBannerController.get_category_filters_for_banner);
router.post('/wear/banner/track-click/:bannerId', wearBannerController.track_click);

// --- WEAR CART ---
const wearCartController = require('../controllers/wear/wearCartController');
router.post('/wear/cart/add', authMiddleware, wearCartController.addToCart);
router.get('/wear/cart/get', authMiddleware, wearCartController.getCart);
router.post('/wear/cart/update-quantity', authMiddleware, wearCartController.updateQuantity);
router.delete('/wear/cart/remove/:cartId', authMiddleware, wearCartController.removeFromCart);
router.delete('/wear/cart/clear', authMiddleware, wearCartController.clearCart);
// --- WEAR WISHLIST ---
const wearWishlistController = require('../controllers/wear/wearWishlistController');
router.post('/wear/wishlist/add', authMiddleware, wearWishlistController.add_to_wishlist);
router.get('/wear/wishlist/get', authMiddleware, wearWishlistController.get_wishlist);
router.delete('/wear/wishlist/remove/:productId', authMiddleware, wearWishlistController.remove_from_wishlist);



// Admin Routes (for Dashboard)
router.get('/admin/wear/locations', authMiddleware, addressController.get_all_addresses_admin);
router.get('/wear/supplier/list', authMiddleware, wearSupplierController.get_suppliers);
router.put('/wear/supplier/update-status/:supplierId', authMiddleware, wearSupplierController.update_status);
router.put('/wear/supplier/update/:supplierId', authMiddleware, wearSupplierController.update_supplier);
router.delete('/wear/supplier/delete/:supplierId', authMiddleware, wearSupplierController.delete_supplier);

// Legacy/Compatibility Auth Routes (Moved for unification)
router.post('/admin-login', authLimiter, authControllers.admin_login);
router.post('/seller-register', authLimiter, authControllers.seller_register);
router.post('/seller-login', authLimiter, authControllers.seller_login);
router.post('/hire-register', authLimiter, authControllers.hire_register);
router.post('/hire-login', authLimiter, authControllers.hire_login);
router.get('/get-user', authMiddleware, authControllers.getUser);
router.get('/logout', authMiddleware, authControllers.logout);

// Admin Settings & Dashboard Data
router.get('/admin/get-dashboard-data', authMiddleware, dashboardController.get_admin_dashboard_data);
router.get('/seller/get-dashboard-data', authMiddleware, dashboardController.get_seller_dashboard_data);
router.get('/admin/settings', authMiddleware, adminSettingsController.getAllSettings);
router.get('/admin/settings/:key', authMiddleware, adminSettingsController.getSetting);
router.post('/admin/settings', authMiddleware, adminSettingsController.updateSetting);
router.post('/admin/settings/menu-display-mode', authMiddleware, adminSettingsController.updateMenuDisplayMode);

// Wear Logs
router.get('/wear/log/admin/logs', authMiddleware, wearLogController.getLogs);
router.get('/wear/log/admin/stats', authMiddleware, wearLogController.getStats);
router.get('/wear/log/admin/user/:deviceId', authMiddleware, wearLogController.getUserDetails);
router.delete('/wear/log/admin/delete/:id', authMiddleware, wearLogController.deleteLog);
router.delete('/wear/log/admin/clear-all', authMiddleware, wearLogController.clearLogs);

// Wear Catalog - Supplier Specific (Dashboard)
router.get('/wear/supplier/catalog/manual-list', authMiddleware, wearCatalogController.get_supplier_catalogs);

// 1. Authentication & Onboarding
router.get('/config/initial-data', configController.get_initial_data);
router.post('/auth/send-otp', otpSendLimiter, wearAuthController.send_otp);
router.post('/auth/verify-otp', otpVerifyLimiter, wearAuthController.verify_otp);
router.post('/auth/refresh-token', wearAuthController.refresh_token);
router.post('/auth/firebase-phone-login', authLimiter, firebaseAuthController.firebasePhoneLogin);
router.post('/auth/google-login', authLimiter, googleAuthController.googleLogin);
router.put('/user/onboarding', authMiddleware, wearAuthController.update_profile);

// 2. Home Screen & Catalog
router.get('/home/layout', homeLayoutController.get_home_layout);
router.get('/home/categories', homeLayoutController.get_home_categories);
router.get('/home/banners', homeLayoutController.get_home_banners);
router.get('/home/location', homeLayoutController.get_home_location);
router.get('/search/suggestions', homeLayoutController.get_search_suggestions);
router.post('/search/save', authOptional, homeLayoutController.save_search_query);
router.get('/search/history', authOptional, homeLayoutController.get_search_history);
router.get('/search/trending', homeLayoutController.get_trending_data);

// 3. Product Listings & Search
router.get('/products', homeControllers.query_products); // Reusing existing
router.get('/products/:slug', homeControllers.product_details); // Reusing existing (by slug)
// router.get('/products/:id', productController.product_get); // Alternatively by ID
router.get('/products/related/:slug', homeControllers.product_details); // Same as details for now but can be specific
router.post('/products/validate-recent', homeControllers.validate_recent_products);
router.post('/user/recent-view', homeControllers.add_to_recent);
router.get('/user/recent-view/:userId', homeControllers.get_recent_products);

// 4. Cart & Shopping Management
router.get('/cart/:userId', cardController.get_card_products);
router.post('/cart/add', cardController.add_to_card);
router.put('/cart/update-item/:card_id', cardController.quantity_inc); // Or a specific update-item method
router.delete('/cart/remove/:card_id', cardController.delete_card_products);
router.post('/cart/move-to-wishlist', cardController.add_wishlist);

// 5. Address & Checkout
router.get('/user/addresses', authMiddleware, addressController.get_addresses);
router.post('/user/addresses', authMiddleware, addressController.add_address);
router.get('/user/addresses/:addressId', authMiddleware, addressController.get_address_by_id);
router.put('/user/addresses/:addressId', authMiddleware, addressController.update_address);
router.delete('/user/addresses/:addressId', authMiddleware, addressController.delete_address);
router.post('/checkout/calculate', checkoutController.calculate_checkout);
router.get('/coupons', checkoutController.get_coupons);

// 6. Payment & Order Processing
router.post('/home/order/place-order', authMiddleware, orderController.place_order);
router.post('/orders/initiate', authMiddleware, orderController.create_payment); // initiate (Razorpay/Stripe)
router.post('/orders/razorpay-create-order', authMiddleware, orderController.create_razorpay_order);
router.post('/orders/razorpay-verify', authMiddleware, orderController.verify_razorpay_payment);
router.get('/orders/verify-payment/:orderId', authMiddleware, orderController.order_confirm); // verify/confirm
router.get('/orders/history/:customerId/:status', orderController.get_orders);
router.get('/orders/details/:orderId', orderController.get_order_details);

// 7. Profile & Account Settings
router.get('/user/profile', authMiddleware, profileController.get_profile);
router.put('/user/profile/update', authMiddleware, profileController.update_profile);
router.get('/user/wallet', authMiddleware, walletController.get_wallet);
router.post('/admin/wallet/update', authMiddleware, adminMiddleware, walletController.update_wallet_admin);
router.get('/user/bank-details', authMiddleware, profileController.get_bank_details);
router.post('/user/support', authMiddleware, profileController.submit_support_ticket);

// Notification Settings
router.get('/user/notification-settings', authMiddleware, profileController.get_notification_settings);
router.put('/user/notification-settings', authMiddleware, profileController.update_notification_settings);

// Privacy Settings
router.get('/user/privacy-settings', authMiddleware, profileController.get_privacy_settings);
router.put('/user/privacy-settings', authMiddleware, profileController.update_privacy_settings);

// 8. Marketplace & Business (Supplier)
router.post('/supplier/apply', authMiddleware, supplierController.apply_supplier);
router.get('/supplier/status', authMiddleware, supplierController.get_status);
router.get('/supplier/enrolment', authMiddleware, supplierController.get_enrolment);

// 9. Social & Interaction
router.post('/products/:id/review', authMiddleware, homeControllers.submit_review);
router.post('/wishlist/toggle', authMiddleware, cardController.wishlist_toggle);
// --- 11. ADMIN CONTROL TOWER (Permission Based) ---
router.get('/admin/stats/financial', authMiddleware, adminMiddleware, adminWearController.get_financial_stats);
router.post('/admin/vendor/commission', authMiddleware, adminMiddleware, adminWearController.update_vendor_commission);
router.get('/admin/vendor/rankings', authMiddleware, adminMiddleware, adminWearController.get_vendor_rankings);
router.get('/admin/vendor/sla', authMiddleware, adminMiddleware, adminWearController.get_sla_report);
router.put('/admin/vendor/status/:supplierId', authMiddleware, adminMiddleware, adminWearController.update_vendor_status);
router.get('/admin/vendor/report/:supplierId', authMiddleware, adminMiddleware, adminWearController.get_vendor_sales_report);
router.get('/admin/order/details/:orderId', authMiddleware, adminMiddleware, adminWearController.get_order_details_admin);
router.post('/admin/order/force-cancel/:orderId', authMiddleware, adminMiddleware, adminWearController.force_cancel_order);
router.post('/admin/order/trigger-refund/:orderId', authMiddleware, adminMiddleware, adminWearController.trigger_manual_refund);
router.put('/admin/product/status/:productId', authMiddleware, adminMiddleware, adminWearController.toggle_product_status);
router.put('/admin/product/moderate/:productId', authMiddleware, adminMiddleware, adminWearController.moderate_product);
router.put('/admin/product/feature/:productId', authMiddleware, adminMiddleware, adminWearController.feature_product);
router.post('/admin/product/cleanup-duplicates', authMiddleware, adminMiddleware, adminWearController.remove_duplicate_products);
router.post('/admin/product/bulk-category', authMiddleware, adminMiddleware, adminWearController.bulk_category_update);
router.get('/admin/analytics/advanced', authMiddleware, adminMiddleware, adminWearController.get_advanced_analytics);
router.get('/admin/risk/report', authMiddleware, adminMiddleware, adminWearController.get_risk_report);
router.get('/admin/risk/suspicious-logins', authMiddleware, adminMiddleware, adminWearController.get_suspicious_logins);
router.post('/admin/risk/disable-cod/:userId', authMiddleware, adminMiddleware, adminWearController.disable_cod_for_user);   // WearRisk — disable COD
router.get('/admin/logs/audit', authMiddleware, adminMiddleware, adminWearController.get_audit_logs);
router.post('/admin/config/home-layout', authMiddleware, adminMiddleware, adminWearController.update_home_layout_config);

// Force-logout (original + aliases used by WearRisk)
router.post('/admin/user/force-logout/:userId', authMiddleware, adminMiddleware, adminWearController.force_logout_user);
router.post('/admin/security/force-logout/:userId', authMiddleware, adminMiddleware, adminWearController.force_logout_user);  // alias
router.post('/admin/security/global-force-logout', authMiddleware, adminMiddleware, adminWearController.global_force_logout); // WearRisk — nuke all sessions

// WearOrders — list endpoint with wear-specific filters
router.get('/admin/orders/wear', authMiddleware, adminMiddleware, adminWearController.get_all_orders_admin);
router.get('/admin/orders', authMiddleware, adminMiddleware, adminWearController.get_all_orders_admin); // legacy alias

module.exports = router;
