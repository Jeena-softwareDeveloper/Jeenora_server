const homeContentController = require('../../controllers/Awareness/HomeContentController');
const router = require('express').Router();
const { authMiddleware, sellerAdminMiddleware } = require('../../middlewares/authMiddleware');

// Public
router.get('/home-content/:key', homeContentController.get_content);
router.get('/home-content', homeContentController.get_all_content);

router.post('/admin/home-content/:key', authMiddleware, sellerAdminMiddleware, homeContentController.update_content);

module.exports = router;
