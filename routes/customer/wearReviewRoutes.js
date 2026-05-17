const router = require('express').Router();
const wearReviewController = require('../../controllers/customer/wearReviewController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// Customer routes
router.post('/add-review', authMiddleware, wearReviewController.add_review);
router.get('/catalog/:catalogId', wearReviewController.get_catalog_reviews);
router.post('/helpful/:reviewId', wearReviewController.mark_helpful);

// Admin routes
router.get('/list', authMiddleware, wearReviewController.get_all_reviews);
router.get('/admin/all', authMiddleware, wearReviewController.get_all_reviews);
router.put('/admin/status/:reviewId', authMiddleware, wearReviewController.update_review_status);

module.exports = router;
