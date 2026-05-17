const homeControllers = require('../../controllers/customer/homeControllers')
const { apiLimiter } = require('../../middlewares/securityMiddleware')
const { authMiddleware } = require('../../middlewares/authMiddleware')

const router = require('express').Router()

router.get('/get-gategorys', homeControllers.get_categorys)
router.get('/products/all', homeControllers.get_products)
router.get('/products/top-rated', homeControllers.get_top_rated_products)
router.get('/products/price-range', homeControllers.price_range_product)
router.get('/products/search', homeControllers.query_products)
router.get('/products/details/:slug', homeControllers.product_details)
router.get('/products/related', homeControllers.get_related_products)
router.get('/products/similar', homeControllers.get_similar_products)
router.get('/products/recent/:userId', homeControllers.get_recent_products)
router.post('/products/social-stats', homeControllers.get_social_stats)

router.post('/customer/submit-review', apiLimiter, homeControllers.submit_review)
router.get('/customer/get-reviews/:productId', homeControllers.get_reviews)

// Customer AI Features
const aiMasterController = require('../../controllers/superadmin/aiMasterController');
router.post('/customer/ai/semantic-search', aiMasterController.conversational_search);
router.post('/customer/ai/stylist', aiMasterController.virtual_stylist);
router.post('/customer/ai/size-predictor', aiMasterController.size_predictor);
router.get('/customer/ai/languages', aiMasterController.get_support_languages);
router.post('/customer/ai/support', authMiddleware, aiMasterController.ai_customer_support);
router.post('/customer/ai/track-behavior', aiMasterController.track_behavior);
router.get('/customer/ai/personalized-recommendations', aiMasterController.get_personalized_recommendations);

// 🧠 Emotion-Aware Nudge — detects hesitation & sends contextual AI message
// Signals: 'long_view' | 'cart_remove' | 'price_hover' | 'repeat_visit'
router.post('/customer/ai/nudge', aiMasterController.emotion_aware_nudge);

// 🌍 Hyper-Local Social Proof — city-wise purchase counts for product cards
router.post('/products/local-social-proof', homeControllers.get_local_social_proof);

module.exports = router