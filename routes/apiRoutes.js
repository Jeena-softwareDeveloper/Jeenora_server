const router = require('express').Router();


const { authMiddleware, authOptional } = require('../middlewares/authMiddleware');
const { otpSendLimiter, otpVerifyLimiter } = require('../middlewares/securityMiddleware');

// ============================================================
// 8. VENDOR & SUPPLIER MANAGEMENT (Prioritized)
// ============================================================
const supplierController = require('../controllers/wear/supplierController');
router.use('/wear/supplier', require('./wear/supplierRoutes'));
router.put('/wear/supplier/update-status/:supplierId', authMiddleware, supplierController.update_status); 

// ============================================================
// 📁 CORE SYSTEMS & LEGACY COMPATIBILITY
// ============================================================
router.use('/admin/risk', require('./admin/adminRiskRoutes')); 
router.use('/admin/security', require('./admin/adminRiskRoutes')); 

// Advanced Analytics
const adminWearController = require('../controllers/wear/adminWearController');
router.get('/admin/analytics/advanced', authMiddleware, adminWearController.get_advanced_analytics);


// Admin Settings (Direct match to fix 404s)
const adminSettingsController = require('../controllers/wear/adminSettingsController');
router.get('/admin/settings/menuDisplayMode', authMiddleware, (req,res,next)=>{req.params.key='menuDisplayMode';next();}, adminSettingsController.getSetting);
router.get('/admin/settings/wear_config', authMiddleware, (req,res,next)=>{req.params.key='wear_config';next();}, adminSettingsController.getSetting);
router.get('/admin/settings', authMiddleware, adminSettingsController.getAllSettings);
router.get('/admin/settings/:key', authMiddleware, adminSettingsController.getSetting);

router.use('/admin/jobs', require('./admin/adminJobRoutes'));
router.use('/admin/applications', require('./admin/adminApplicationRoutes'));
router.use('/admin/resumes', require('./admin/adminResumeRoutes'));
router.use('/admin/chat-support', require('./admin/chatSupportRoutes'));

router.use('/hire', require('./hire/jobRoutes')); // Proxy for all hire routes
router.use('/hire/payment', require('./hire/paymentRoutes'));
router.use('/analytics', require('./analytics/index'));
router.use('/market', require('./Awareness/marketRoutes'));
router.use('/search', require('./wear/searchRoutes'));

router.use('/wear/home', require('./wear/homeRoutes'));
router.use('/wear/category', require('./wear/wearCategoryRoutes'));
router.use('/wear/review', require('./wear/wearReviewRoutes'));

// 2. PRODUCT & CATALOG MANAGEMENT (Seller/Admin)
router.use('/wear/catalog', require('./wear/productRoutes'));

// 3. AUTHENTICATION & ONBOARDING
const wearAuthController = require('../controllers/wear/authController');
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
router.use('/wear/cart', require('./wear/wearCartRoutes'));
router.use('/wear/wishlist', require('./wear/wearWishlistRoutes'));
router.use('/wear/offers', require('./wear/wearOfferRoutes'));

// Aliases & Modular routes
router.use('/wear/banner', require('./wear/wearBannerRoutes'));
router.use('/wear/banners', require('./wear/wearBannerRoutes'));
router.use('/wear/offer', require('./wear/wearOfferRoutes'));
router.use('/user/addresses', require('./wear/addressRoutes'));
router.use('/wear/user', require('./wear/userProfileRoutes'));
router.use('/wear/address', require('./wear/addressRoutes'));

// 6. TRANSACTIONS & SUPPLIER
router.use('/wear/payment', require('./wear/paymentRoutes')); // Stripe & withdrawal
router.use('/wear/orders', require('./wear/orderRoutes'));
router.use('/wear/delivery', require('./wear/deliveryRoutes'));

// 7. DASHBOARD, LOGS & ANALYTICS
const wearLogController = require('../controllers/wear/wearLogController');
router.get('/wear/logs', authMiddleware, wearLogController.getLogs); // Dashboard Alias
router.get('/wear/stats', authMiddleware, wearLogController.getStats); // Dashboard Alias
router.use('/wear/logs', require('./wear/wearLogRoutes'));
router.use('/wear/dashboard', require('./wear/dashboardRoutes'));

router.use('/wear/whatsapp', require('./wear/wearWhatsAppRoutes'));
router.use('/hire/whatsapp', require('./wear/wearWhatsAppRoutes')); // Mirror for Dashboard compatibility
router.use('/', require('./wear/productOfferRoutes'));
router.get('/wear/buyers', authMiddleware, adminWearController.get_wear_buyers);

const homeControllers = require('../controllers/wear/homeControllers');
const configController = require('../controllers/wear/configController');
router.get('/config/initial-data', configController.get_initial_data);
router.get('/config/nav-menu/:platform', configController.get_nav_menu);
router.post('/config/nav-menu/update', configController.update_nav_menu);
router.get('/products/:slug', homeControllers.product_details); // Old Detail Path
router.get('/get-products', homeControllers.get_products); // Old Home Path
router.use('/', require('./wear/sellerRoutes'));

router.use('/', require('./wear/legacyAuthRoutes')); 

module.exports = router;
