const express = require('express');
const router = express.Router();
const { userController, adminController } = require('../../controllers/hire/notificationController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// USER ROUTES
router.get('/', authMiddleware, userController.getMyNotifications);
router.get('/stats', authMiddleware, userController.getNotificationStats);
router.patch('/:notifId/read', authMiddleware, userController.markAsRead);
router.patch('/mark-all-read', authMiddleware, userController.markAllAsRead);
router.delete('/:notifId', authMiddleware, userController.deleteNotification);

// ADMIN ROUTES
router.get('/whatsapp-status', authMiddleware, adminController.getWhatsAppConnectionStatus);
router.post('/send', authMiddleware, adminController.sendNotification);
router.get('/all', authMiddleware, adminController.listAllNotifications);
router.delete('/:notifId', authMiddleware, adminController.deleteNotificationAdmin);

module.exports = router;