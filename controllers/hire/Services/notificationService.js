const Notification = require('../../../models/hire/notificationModel');
const { sendEmail } = require('./emailService');


exports.createNotification = async ({
  userId,
  title,
  message,
  type = 'system',
  category = 'System',
  link = null,
  channel = ['dashboard'],
  meta = {},
  scheduledAt = null
}) => {
  console.log(`[NotificationService] Creating notification for user ${userId}: ${title}`);
  try {
    // Use channels as provided
    const actualChannels = channel;

    // Create notification in database
    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
      category,
      link,
      channel: actualChannels,
      meta,
      scheduledAt,
      sent: {
        dashboard: actualChannels.includes('dashboard'),
        email: false
      }
    });

    // Send via different channels
    const sendPromises = [];

    if (actualChannels.includes('email')) {
      sendPromises.push(
        sendEmail(userId, title, message)
          .then(success => {
            if (success) {
              notification.sent.email = true;
            }
          })
      );
    }

    // Wait for all sending operations to complete
    await Promise.all(sendPromises);

    // Save updated sent status
    await notification.save();

    console.log(`✅ Notification created for user ${userId}: ${title}`);
    return notification;
  } catch (err) {
    console.error('❌ Error creating notification:', err.message);
    throw err;
  }
};

// Bulk notification creation
exports.createBulkNotifications = async (userIds, notificationData) => {
  try {
    const notifications = [];

    // Create individual notifications
    for (const userId of userIds) {
      const notification = await this.createNotification({
        userId,
        ...notificationData
      });
      notifications.push(notification);
    }

    return notifications;
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    throw error;
  }
};

// Get unread notifications count
exports.getUnreadCount = async (userId) => {
  return await Notification.countDocuments({
    userId,
    isRead: false
  });
};
