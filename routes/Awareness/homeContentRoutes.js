const homeContentController = require('../../controllers/Awareness/HomeContentController');
const router = require('express').Router();
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.get('/home-content/:key', homeContentController.get_content);
router.get('/home-content', homeContentController.get_all_content);
router.post('/home-content/:key', homeContentController.update_content); // simplified for this task

module.exports = router;
