const express = require('express');
const router = express.Router();
const staticContentController = require('../../controllers/hire/staticContentController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// Public route to get content for a page
router.get('/:page', staticContentController.getContent);

// Admin routes to manage all content
router.get('/', authMiddleware, staticContentController.getAllContent);
router.post('/:page', authMiddleware, staticContentController.updateContent);

module.exports = router;
