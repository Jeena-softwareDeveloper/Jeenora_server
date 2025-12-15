const { createNotification } = require('./notificationService');
const { isWhatsAppReady } = require('../../../controllers/Awareness/WhatsappController'); // Import your WhatsApp status

// Auto-trigger notification examples with WhatsApp integration
class AutomatedNotificationService {
  
  // Job Match Notification
  static async sendJobMatchNotification(userId, job) {
    const whatsappAvailable = isWhatsAppReady ? isWhatsAppReady() : false;
    
    return await createNotification({
      userId,
      title: '🎯 New Job Matched!',
      message: `A new job in ${job.location} suits your skill (${job.category}). Check it out!`,
      type: 'job',
      category: 'Job',
      link: `/jobs/${job._id}`,
      channel: whatsappAvailable ? ['dashboard', 'whatsapp'] : ['dashboard'],
      meta: { jobId: job._id, location: job.location, category: job.category }
    });
  }

  // Payment Success Notification
  static async sendPaymentSuccessNotification(userId, plan, expiryDate) {
    return await createNotification({
      userId,
      title: '🧾 Payment Success!',
      message: `Your ${plan.name} plan is active till ${expiryDate}. Enjoy premium features!`,
      type: 'payment',
      category: 'Payment',
      channel: ['dashboard', 'email'], // Usually email for payments
      meta: { plan: plan.name, expiryDate, price: plan.price }
    });
  }

  // Interview Scheduled Notification
  static async sendInterviewNotification(userId, job, dateTime) {
    const whatsappAvailable = isWhatsAppReady ? isWhatsAppReady() : false;
    
    return await createNotification({
      userId,
      title: '💼 Interview Scheduled!',
      message: `Your interview for "${job.title}" is scheduled on ${dateTime}. Please be prepared!`,
      type: 'interview',
      category: 'Interview',
      link: `/interviews/${job._id}`,
      channel: whatsappAvailable ? ['dashboard', 'email', 'whatsapp'] : ['dashboard', 'email'],
      meta: { jobId: job._id, interviewDate: dateTime, company: job.company }
    });
  }

  // Selection Status Notification
  static async sendSelectionNotification(userId, company) {
    const whatsappAvailable = isWhatsAppReady ? isWhatsAppReady() : false;
    
    return await createNotification({
      userId,
      title: '✅ Selection Update!',
      message: `Congratulations! You've been selected by ${company}. They will contact you soon.`,
      type: 'status',
      category: 'Alert',
      channel: whatsappAvailable ? ['dashboard', 'whatsapp'] : ['dashboard'],
      meta: { company, status: 'selected' }
    });
  }

  // Plan Expiry Reminder (for cron job)
  static async sendPlanExpiryReminder(userId, plan, daysLeft) {
    return await createNotification({
      userId,
      title: '⚠️ Plan Expiry Soon!',
      message: `Your ${plan.name} plan will expire in ${daysLeft} days. Renew to continue premium features.`,
      type: 'payment',
      category: 'Alert',
      channel: ['dashboard', 'email'], // Email for important reminders
      meta: { plan: plan.name, daysLeft, isExpiryReminder: true }
    });
  }

  // Urgent Alert (WhatsApp priority)
  static async sendUrgentAlert(userId, title, message) {
    const whatsappAvailable = isWhatsAppReady ? isWhatsAppReady() : false;
    
    return await createNotification({
      userId,
      title: `🚨 ${title}`,
      message: message,
      type: 'system',
      category: 'Alert',
      channel: whatsappAvailable ? ['dashboard', 'whatsapp', 'email'] : ['dashboard', 'email'],
      meta: { urgent: true, priority: 'high' }
    });
  }
}

module.exports = AutomatedNotificationService;