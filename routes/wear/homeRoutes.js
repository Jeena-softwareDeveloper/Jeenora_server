const homeControllers = require('../../controllers/wear/homeControllers')
const { apiLimiter } = require('../../middlewares/securityMiddleware')

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

module.exports = router