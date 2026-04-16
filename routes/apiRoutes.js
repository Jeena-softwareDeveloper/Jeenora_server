const router = require('express').Router();
const { authMiddleware, authOptional } = require('../middlewares/authMiddleware');
const { otpSendLimiter, otpVerifyLimiter } = require('../middlewares/securityMiddleware');

// ============================================================
// 📁 NON-WEAR MODULAR SYSTEMS (External Projects)
// ============================================================
router.use('/admin/jobs', require('./admin/adminJobRoutes'));
router.use('/admin/applications', require('./admin/adminApplicationRoutes'));
router.use('/admin/resumes', require('./admin/adminResumeRoutes'));
router.use('/admin/chat-support', require('./admin/chatSupportRoutes'));

router.use('/hire', require('./hire/jobRoutes')); // Proxy for all hire routes
router.use('/analytics', require('./analytics/index'));
router.use('/market', require('./Awareness/marketRoutes'));

// ============================================================
// 🎯 MODULAR WEAR STOREFRONT APIS (Splitted & Useful)
// ============================================================

// 1. PUBLIC STOREFRONT (Home, Search, Details, Reviews)
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
router.post('/wear/auth/logout', authMiddleware, wearAuthController.logout);

// 4. SHOPPING EXPERIENCE (Cart, Wishlist, Offers)
router.use('/wear/cart', require('./wear/wearCartRoutes'));
router.use('/wear/wishlist', require('./wear/wearWishlistRoutes'));
router.use('/wear/offers', require('./wear/wearOfferRoutes'));

// 5. USER ACCOUNT (Profile, Address, Wallet)
router.use('/wear/user', require('./wear/userProfileRoutes'));
router.use('/wear/address', require('./wear/addressRoutes'));

// 6. TRANSACTIONS & SUPPLIER
router.use('/wear/orders', require('./wear/orderRoutes'));
router.use('/wear/supplier', require('./wear/supplierRoutes'));

// 7. DASHBOARD & ANALYTICS
router.use('/wear/dashboard', require('./wear/dashboardRoutes'));
router.use('/wear/logs', require('./wear/wearLogRoutes'));

// 8. BANNERS
router.use('/wear/banners', require('./wear/wearBannerRoutes'));

// ============================================================
// ⚠️ LEGACY COMPATIBILITY (Temporary Redirects)
// ============================================================
const homeControllers = require('../controllers/wear/homeControllers');
router.get('/config/initial-data', require('../controllers/wear/configController').get_initial_data);
router.get('/products/:slug', homeControllers.product_details); // Old Detail Path
router.get('/get-products', homeControllers.get_products); // Old Home Path
router.use('/user/addresses', require('./wear/addressRoutes')); // Legacy Address Path

module.exports = router;
