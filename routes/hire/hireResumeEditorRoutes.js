const express = require('express');
const router = express.Router();
const hireResumeEditorController = require('../../controllers/hire/hireResumeEditorController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// Resume Editor Routes
router.post('/request', authMiddleware, hireResumeEditorController.createEditRequest); // #swagger.tags = ['Hire Resume Editor']
router.get('/requests', authMiddleware, hireResumeEditorController.getUserRequests); // #swagger.tags = ['Hire Resume Editor']
router.get('/request/:id', authMiddleware, hireResumeEditorController.getRequestDetails); // #swagger.tags = ['Hire Resume Editor']

module.exports = router;
