const router = require('express').Router();
const searchController = require('../../controllers/customer/searchController');

router.get('/suggestions', searchController.get_suggestions);
router.post('/save', searchController.save_search);
router.get('/history', searchController.get_history);
router.get('/trending', searchController.get_trending);

module.exports = router;
