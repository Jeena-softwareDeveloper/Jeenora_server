const homeControllers = require('../../controllers/wear/homeControllers')
const { apiLimiter } = require('../../middlewares/securityMiddleware')

const router = require('express').Router()

router.get('/get-gategorys', homeControllers.get_categorys)
router.get('/get-products', homeControllers.get_products)
router.get('/price-range-latest-product', homeControllers.price_range_product)
router.get('/query-products', homeControllers.query_products)
router.get('/product-details/:slug', homeControllers.product_details)
router.post('/customer/submit-review', apiLimiter, homeControllers.submit_review)
router.get('/customer/get-reviews/:productId', homeControllers.get_reviews)
module.exports = router