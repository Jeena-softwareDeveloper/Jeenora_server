const express = require('express');
const router = express.Router();
const interviewController = require('../../controllers/hire/interviewController');
const { authMiddleware } = require('../../middlewares/authMiddleware');


router.post('/', authMiddleware, interviewController.scheduleInterview); // #swagger.tags = ['Hire Interview']
router.get('/', authMiddleware, interviewController.getInterviews); // #swagger.tags = ['Hire Interview']
router.put('/:id', authMiddleware, interviewController.updateInterview); // #swagger.tags = ['Hire Interview']
router.post('/:id/sync', authMiddleware, interviewController.syncCalendar); // #swagger.tags = ['Hire Interview']


module.exports = router;
