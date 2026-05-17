const router = require('express').Router();
const wearLogController = require('../../controllers/admin/wearLogController');
const { authMiddleware, authOptional } = require('../../middlewares/authMiddleware');

// Public/App routes
router.post('/log', authOptional, wearLogController.logActivity);

// Admin routes
router.get('/admin/logs', authMiddleware, wearLogController.getLogs);
router.get('/admin/stats', authMiddleware, wearLogController.getStats);
router.get('/admin/user/:deviceId', authMiddleware, wearLogController.getUserDetails);
router.delete('/admin/delete/:id', authMiddleware, wearLogController.deleteLog);
router.delete('/admin/clear-all', authMiddleware, wearLogController.clearLogs);

module.exports = router;
