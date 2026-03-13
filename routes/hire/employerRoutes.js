const express = require('express');
const router = express.Router();
const employerController = require('../../controllers/hire/employerController');
const { authMiddleware } = require('../../middlewares/authMiddleware');


router.post('/jobs', authMiddleware, employerController.postJob); // #swagger.tags = ['Hire Employer']
router.get('/jobs', authMiddleware, employerController.getMyJobs); // #swagger.tags = ['Hire Employer']
router.post('/jobs/:id/shortlist', authMiddleware, employerController.shortlistCandidate); // #swagger.tags = ['Hire Employer']
router.get('/analytics', authMiddleware, employerController.getAnalytics); // #swagger.tags = ['Hire Employer']


module.exports = router;
