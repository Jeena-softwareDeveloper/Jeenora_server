const express = require('express');
const router = express.Router();
const hireResumeController = require('../../controllers/hire/hireResumeController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// Resume CRUD
router.post('/upload', authMiddleware, hireResumeController.uploadResume); // #swagger.tags = ['Hire Resume']
router.get('/list', authMiddleware, hireResumeController.getResumes); // #swagger.tags = ['Hire Resume']
router.delete('/:resumeId', authMiddleware, hireResumeController.deleteResume); // #swagger.tags = ['Hire Resume']
router.put('/:resumeId/primary', authMiddleware, hireResumeController.setPrimaryResume); // #swagger.tags = ['Hire Resume']

module.exports = router;
