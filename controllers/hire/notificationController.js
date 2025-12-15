const Notification = require('../../models/hire/notificationModel');
const { createNotification, createBulkNotifications, getUnreadCount, getWhatsAppStatus } = require('./Services/notificationService');
const HireUser = require('../../models/hire/hireUserModel');
const { responseReturn } = require('../../utiles/response');

// User Notification Controller
class NotificationController {
  
  // Get all notifications with pagination
  getMyNotifications = async (req, res) => {
    try {
      const userId = req.userId;
      const { page = 1, limit = 10, category, unreadOnly } = req.query;
      
      const query = { userId };
      
      // Filter by category
      if (category && category !== 'all') {
        query.category = category;
      }
      
      // Filter unread only
      if (unreadOnly === 'true') {
        query.isRead = false;
      }
      
      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
      
      const total = await Notification.countDocuments(query);
      const unreadCount = await getUnreadCount(userId);
      const whatsappStatus = getWhatsAppStatus();
      
      responseReturn(res, 200, { 
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalNotifications: total,
          hasNext: page < Math.ceil(total / limit)
        },
        unreadCount,
        whatsappStatus
      });
    } catch (err) {
      console.error('Error in getMyNotifications:', err);
      responseReturn(res, 500, { error: err.message });
    }
  };

  // Mark one notification as read
  markAsRead = async (req, res) => {
    try {
      const userId = req.userId;
      const { notifId } = req.params;
      
      await Notification.updateOne(
        { _id: notifId, userId }, 
        { $set: { isRead: true } }
      );
      
      const unreadCount = await getUnreadCount(userId);
      
      responseReturn(res, 200, { 
        message: 'Notification marked as read',
        unreadCount 
      });
    } catch (err) {
      console.error('Error in markAsRead:', err);
      responseReturn(res, 500, { error: err.message });
    }
  };

  // Mark all as read
  markAllAsRead = async (req, res) => {
    try {
      const userId = req.userId;
      
      await Notification.updateMany(
        { userId, isRead: false }, 
        { $set: { isRead: true } }
      );
      
      responseReturn(res, 200, { 
        message: 'All notifications marked as read' 
      });
    } catch (err) {
      console.error('Error in markAllAsRead:', err);
      responseReturn(res, 500, { error: err.message });
    }
  };

  // Delete a notification
  deleteNotification = async (req, res) => {
    try {
      const userId = req.userId;
      const { notifId } = req.params;
      
      await Notification.deleteOne({ _id: notifId, userId });
      
      const unreadCount = await getUnreadCount(userId);
      
      responseReturn(res, 200, { 
        message: 'Notification deleted successfully',
        unreadCount 
      });
    } catch (err) {
      console.error('Error in deleteNotification:', err);
      responseReturn(res, 500, { error: err.message });
    }
  };

  // Get notification statistics
  getNotificationStats = async (req, res) => {
    try {
      const userId = req.userId;
      
      const stats = await Notification.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            unread: {
              $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
            }
          }
        }
      ]);
      
      const total = await Notification.countDocuments({ userId });
      const unreadCount = await getUnreadCount(userId);
      const whatsappStatus = getWhatsAppStatus();
      
      responseReturn(res, 200, {
        stats,
        total,
        unreadCount,
        whatsappStatus
      });
    } catch (err) {
      console.error('Error in getNotificationStats:', err);
      responseReturn(res, 500, { error: err.message });
    }
  };
}

// Admin Notification Controller
class AdminNotificationController {

  // Send message to selected users or all
  sendNotification = async (req, res) => {
    try {
      const { target, title, message, type = 'system', category = 'System', channel = ['dashboard'] } = req.body;

      if (!target || !title || !message) {
        return responseReturn(res, 400, { 
          error: 'Target, title, and message are required' 
        });
      }

      let users = [];
      if (target === 'all') {
        users = await HireUser.find({}).select('_id');
      } else if (Array.isArray(target)) {
        users = await HireUser.find({ _id: { $in: target } }).select('_id');
      } else {
        return responseReturn(res, 400, { 
          error: 'Target must be "all" or an array of user IDs' 
        });
      }

      const userIds = users.map(user => user._id);
      const whatsappStatus = getWhatsAppStatus();
      
      // Create notifications in bulk
      await createBulkNotifications(userIds, {
        title,
        message,
        type,
        category,
        channel
      });

      responseReturn(res, 200, { 
        message: `Notification sent to ${users.length} users`,
        whatsappStatus
      });
    } catch (err) {
      console.error('Error in sendNotification:', err);
      responseReturn(res, 500, { error: err.message });
    }
  };

  // Admin view all notifications with filters
  listAllNotifications = async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        userId, 
        type, 
        category, 
        channel,
        startDate, 
        endDate 
      } = req.query;
      
      const query = {};
      
      // Apply filters
      if (userId) query.userId = userId;
      if (type) query.type = type;
      if (category) query.category = category;
      if (channel) query.channel = channel;
      
      // Date range filter
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }
      
      const notifications = await Notification.find(query)
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
      
      const total = await Notification.countDocuments(query);
      const whatsappStatus = getWhatsAppStatus();
      
      // Get statistics
      const stats = await Notification.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        }
      ]);
      
      responseReturn(res, 200, { 
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalNotifications: total
        },
        stats,
        whatsappStatus
      });
    } catch (err) {
      console.error('Error in listAllNotifications:', err);
      responseReturn(res, 500, { error: err.message });
    }
  };

  // Delete notification (admin)
  deleteNotificationAdmin = async (req, res) => {
    try {
      const { notifId } = req.params;
      
      await Notification.findByIdAndDelete(notifId);
      
      responseReturn(res, 200, { 
        message: 'Notification deleted successfully' 
      });
    } catch (err) {
      console.error('Error in deleteNotificationAdmin:', err);
      responseReturn(res, 500, { error: err.message });
    }
  };

  // Get WhatsApp connection status
  getWhatsAppConnectionStatus = async (req, res) => {
    try {
      const { getWhatsAppStatus } = require('../path/to/your/whatsappService');
      const whatsappStatus = await getWhatsAppStatus(req, res);
      
      responseReturn(res, 200, {
        whatsappStatus
      });
    } catch (err) {
      console.error('Error getting WhatsApp status:', err);
      responseReturn(res, 500, { error: err.message });
    }
  };
}

module.exports = {
  userController: new NotificationController(),
  adminController: new AdminNotificationController()
};