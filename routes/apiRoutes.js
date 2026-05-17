const router = require('express').Router();
const aiMasterController = require('../controllers/superadmin/aiMasterController');




const { authMiddleware, authOptional } = require('../middlewares/authMiddleware');
const { otpSendLimiter, otpVerifyLimiter } = require('../middlewares/securityMiddleware');

// ============================================================
// 8. VENDOR & SUPPLIER MANAGEMENT (Prioritized)
// ============================================================
const supplierController = require('../controllers/partner/supplierController');
router.use('/wear/supplier', require('./partner/supplierRoutes'));
router.put('/wear/supplier/update-status/:supplierId', authMiddleware, supplierController.update_status); 

// ============================================================
// 📁 CORE SYSTEMS & LEGACY COMPATIBILITY
// ============================================================
router.use('/admin/risk', require('./admin/adminRiskRoutes')); 
router.use('/admin/security', require('./admin/adminRiskRoutes')); 

// Advanced Analytics
const adminWearController = require('../controllers/admin/adminWearController');
router.get('/admin/analytics/advanced', authMiddleware, adminWearController.get_advanced_analytics);


// Admin Settings (Direct match to fix 404s)
const adminSettingsController = require('../controllers/superadmin/adminSettingsController');
router.get('/admin/settings/menuDisplayMode', authMiddleware, (req,res,next)=>{req.params.key='menuDisplayMode';next();}, adminSettingsController.getSetting);
router.get('/admin/settings/wear_config', authMiddleware, (req,res,next)=>{req.params.key='wear_config';next();}, adminSettingsController.getSetting);
router.get('/admin/settings', authMiddleware, adminSettingsController.getAllSettings);
router.get('/admin/settings/:key', authMiddleware, adminSettingsController.getSetting);



router.use('/analytics', require('./analytics/index'));
router.use('/search', require('./customer/searchRoutes'));

router.use('/wear/home', require('./customer/homeRoutes'));
router.use('/wear/category', require('./customer/wearCategoryRoutes'));
router.use('/wear/review', require('./customer/wearReviewRoutes'));

// 2. PRODUCT & CATALOG MANAGEMENT (Partner/Admin)
router.use('/wear/catalog', require('./partner/productRoutes'));

// 3. AUTHENTICATION & ONBOARDING
const wearAuthController = require('../controllers/customer/authController');
router.post('/wear/auth/send-otp', otpSendLimiter, wearAuthController.send_otp);
router.post('/wear/auth/verify-otp', otpVerifyLimiter, wearAuthController.verify_otp);
router.post('/wear/auth/register', wearAuthController.email_signup);
router.post('/wear/auth/login', wearAuthController.email_login);
router.post('/wear/auth/refresh-token', wearAuthController.refresh_token);
router.get('/wear/auth/profile', authMiddleware, wearAuthController.get_profile);
router.put('/wear/auth/update-profile', authMiddleware, wearAuthController.update_profile);
router.post('/wear/auth/profile-image-upload', authMiddleware, wearAuthController.profile_image_upload);
router.post('/wear/auth/logout', authMiddleware, wearAuthController.logout);
router.post('/wear/auth/delete-account', authMiddleware, wearAuthController.delete_account);
// Email verification
router.post('/wear/auth/resend-verification', authMiddleware, wearAuthController.resend_verification_email);
router.get('/wear/auth/verify-email', wearAuthController.verify_email_token);
// Password reset
router.post('/wear/auth/forgot-password', wearAuthController.forgot_password);
router.post('/wear/auth/reset-password', wearAuthController.reset_password);

// 4. SHOPPING EXPERIENCE (Cart, Wishlist, Offers)
router.use('/wear/cart', require('./customer/wearCartRoutes'));
router.use('/wear/wishlist', require('./customer/wearWishlistRoutes'));
router.use('/wear/offers', require('./partner/wearOfferRoutes'));

// Aliases & Modular routes
router.use('/wear/banner', require('./admin/wearBannerRoutes'));
router.use('/wear/banners', require('./admin/wearBannerRoutes'));
router.use('/wear/offer', require('./partner/wearOfferRoutes'));
router.use('/user/addresses', require('./customer/addressRoutes'));
router.use('/wear/user', require('./partner/userProfileRoutes'));
router.use('/wear/address', require('./customer/addressRoutes'));

// 6. TRANSACTIONS & SUPPLIER
router.use('/wear/payment', require('./customer/paymentRoutes')); // Stripe & withdrawal
router.use('/wear/orders', require('./customer/orderRoutes'));
router.use('/wear/delivery', require('./admin/deliveryRoutes'));

// 7. DASHBOARD, LOGS & ANALYTICS
const wearLogController = require('../controllers/admin/wearLogController');
router.get('/wear/logs', authMiddleware, wearLogController.getLogs); // Dashboard Alias
router.get('/wear/stats', authMiddleware, wearLogController.getStats); // Dashboard Alias
router.use('/wear/logs', require('./admin/wearLogRoutes'));
router.use('/wear/dashboard', require('./superadmin/dashboardRoutes'));

router.use('/wear/whatsapp', require('./admin/wearWhatsAppRoutes'));

router.use('/', require('./partner/productOfferRoutes'));
router.get('/wear/buyers', authMiddleware, adminWearController.get_wear_buyers);

const homeControllers = require('../controllers/customer/homeControllers');
const configController = require('../controllers/superadmin/configController');
router.get('/config/initial-data', configController.get_initial_data);
router.get('/config/nav-menu/:platform', configController.get_nav_menu);
router.post('/config/nav-menu/update', configController.update_nav_menu);
router.get('/products/:slug', homeControllers.product_details); // Old Detail Path
router.get('/get-products', homeControllers.get_products); // Old Home Path
router.use('/', require('./partner/partnerRoutes'));

router.use('/', require('./superadmin/legacyAuthRoutes')); 

module.exports = router;
