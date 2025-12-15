// routes/analytics/awareness.js
const express = require('express');
const router = express.Router();
const awarenessController = require('../../controllers/analytics/awarenessController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// Awareness website tracking
router.post('/content-engagement', awarenessController.trackContentEngagement);
router.post('/form-submissions', awarenessController.trackFormSubmission);
router.post('/campaigns', awarenessController.trackCampaign);

// Analytics dashboard (protected)
router.get('/analytics', authMiddleware, awarenessController.getAwarenessAnalytics);

module.exports = router;