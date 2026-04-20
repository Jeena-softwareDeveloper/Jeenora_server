const express = require('express');
const router = express.Router();
const wearCategoryController = require('../../controllers/wear/wearCategoryController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.post('/add', authMiddleware, wearCategoryController.add_category);
router.get('/get', wearCategoryController.get_categories);
router.get('/get-pure', wearCategoryController.get_pure_categories);
router.post('/update/:id', authMiddleware, wearCategoryController.update_category);
router.delete('/delete/:id', authMiddleware, wearCategoryController.delete_category);

module.exports = router;
