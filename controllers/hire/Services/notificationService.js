const Notification = require('../../../models/hire/notificationModel');
const { sendEmail } = require('./emailService');
const { sendWhatsApp, sendBulkWhatsApp } = require('./whatsappService');
const { isWhatsAppReady } = require('../../../controllers/Awareness/WhatsappController'); // Import your WhatsApp status

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
    // Check WhatsApp availability before sending
    const whatsappAvailable = isWhatsAppReady ? isWhatsAppReady() : false;

    // Adjust channels based on availability
    const actualChannels = channel.filter(ch => {
      if (ch === 'whatsapp' && !whatsappAvailable) {
        console.log('⚠️ WhatsApp not available, skipping WhatsApp channel');
        return false;
      }
      return true;
    });

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
        email: false,
        whatsapp: false
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

    if (actualChannels.includes('whatsapp') && whatsappAvailable) {
      sendPromises.push(
        sendWhatsApp(userId, `${title}\n\n${message}`)
          .then(success => {
            if (success) {
              notification.sent.whatsapp = true;
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

// Bulk notification creation with WhatsApp integration
exports.createBulkNotifications = async (userIds, notificationData) => {
  try {
    const notifications = [];
    const whatsappAvailable = isWhatsAppReady ? isWhatsAppReady() : false;

    // Filter channels based on WhatsApp availability
    const actualChannels = notificationData.channel.filter(ch => {
      if (ch === 'whatsapp' && !whatsappAvailable) {
        console.log('⚠️ WhatsApp not available, skipping WhatsApp for bulk messages');
        return false;
      }
      return true;
    });

    // Send WhatsApp in bulk if available and requested
    if (actualChannels.includes('whatsapp') && whatsappAvailable) {
      const whatsappResults = await sendBulkWhatsApp(
        userIds,
        `${notificationData.title}\n\n${notificationData.message}`
      );

      // Create WhatsApp results map for quick lookup
      const whatsappMap = new Map();
      whatsappResults.forEach(result => {
        whatsappMap.set(result.userId.toString(), result);
      });
    }

    // Create individual notifications
    for (const userId of userIds) {
      const notification = await this.createNotification({
        userId,
        ...notificationData,
        channel: actualChannels
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

// Check WhatsApp service status
exports.getWhatsAppStatus = () => {
  return {
    whatsappReady: isWhatsAppReady ? isWhatsAppReady() : false,
    message: isWhatsAppReady && isWhatsAppReady() ?
      '✅ WhatsApp Service Ready' : '❌ WhatsApp Service Not Available'
  };
};