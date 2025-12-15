const express = require('express');
const router = express.Router();


const userController = require('../../controllers/analytics/userController');
const sessionController = require('../../controllers/analytics/sessionController');
const eventController = require('../../controllers/analytics/eventController');
const pageController = require('../../controllers/analytics/pageController');
const presenceController = require('../../controllers/analytics/presenceController');
const funnelController = require('../../controllers/analytics/funnelController');
const predictionController = require('../../controllers/analytics/predectionController');
const dataLakeController = require('../../controllers/analytics/dataLakeController');
const streamEventController = require('../../controllers/analytics/streamEventController');


const { authMiddleware } = require('../../middlewares/authMiddleware');


router.post('/claim', userController.claimUser);
router.get('/',authMiddleware, userController.getAllUsers);
router.get('/users/:userId',authMiddleware, userController.getUserById);

router.delete("/users/:userId", authMiddleware, sessionController.deleteUser);
router.delete("/users/bulk/delete", authMiddleware, sessionController.deleteMultipleUsers);

// Session management routes
router.delete("/sessions/clear-all", authMiddleware, sessionController.clearAllSessions);
router.delete("/sessions/clear-inactive", authMiddleware, sessionController.clearInactiveSessions);
router.delete("/sessions/clear-old", authMiddleware, sessionController.clearOldSessions);
router.delete("/sessions/user/:userId", authMiddleware, sessionController.clearUserSessions);
router.delete("/sessions/bulk/delete", authMiddleware, sessionController.bulkDeleteSessions);
router.delete("/sessions/by-ids", authMiddleware, sessionController.clearSessionsByIds);
router.delete("/sessions/by-date", authMiddleware, sessionController.clearSessionsByDateRange);
router.delete("/sessions/by-device", authMiddleware, sessionController.clearSessionsByDevice);
router.delete("/sessions/by-country", authMiddleware, sessionController.clearSessionsByCountry);
router.delete("/sessions/short", authMiddleware, sessionController.clearShortSessions);
router.delete("/sessions/abandoned", authMiddleware, sessionController.clearAbandonedSessions);
router.delete("/sessions/duplicates", authMiddleware, sessionController.clearDuplicateSessions);
router.get("/sessions/stats", authMiddleware, sessionController.getSessionStats);
router.delete("/sessions/reset-all", authMiddleware, sessionController.resetAllAnalytics);
module.exports = router