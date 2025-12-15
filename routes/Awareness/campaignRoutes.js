const express = require('express');
const subscriberController = require('../../controllers/Awareness/SubscribeController');
const campaignController = require('../../controllers/Awareness/CampaignController');
const whatsappController = require('../../controllers/Awareness/WhatsappController'); // Fixed import name
const { authMiddleware } = require('../../middlewares/authMiddleware');

const router = express.Router();

// ==================== SUBSCRIBER MANAGEMENT ==================== //

// Category Routes
router.post('/subscriber/category', subscriberController.addCategory);
router.get('/subscriber/category', subscriberController.getCategories);
router.get('/subscriber/category/:id', subscriberController.getCategoryById);
router.put('/subscriber/category/:id', authMiddleware, subscriberController.updateCategory);
router.delete('/subscriber/category/:id', authMiddleware, subscriberController.deleteCategory);

// Subscriber Routes
router.post('/subscriber', authMiddleware, subscriberController.addSubscriber);
router.get('/subscribers', subscriberController.getSubscribers);
router.get('/subscriber/:id', subscriberController.getSubscriberById);
router.put('/subscriber/:id', authMiddleware, subscriberController.updateSubscriber);
router.delete('/subscriber/:id', authMiddleware, subscriberController.deleteSubscriber);
router.get('/category/:categoryId/subscribers', subscriberController.getSubscribersByCategory);

// ==================== CAMPAIGN MANAGEMENT ==================== //

// Campaign CRUD
router.post('/campaigns', authMiddleware, campaignController.createCampaign);
router.get('/campaigns', campaignController.getCampaigns);
router.get('/campaigns/:id', campaignController.getCampaignById);
router.put('/campaigns/:id', authMiddleware, campaignController.updateCampaign);
router.delete('/campaigns/:id', authMiddleware, campaignController.deleteCampaign);

// Campaign Actions & Status
router.post('/campaigns/:id/start', authMiddleware, campaignController.startCampaign);
router.post('/campaigns/:id/stop', authMiddleware, campaignController.stopCampaign);
router.post('/campaigns/:id/pause', authMiddleware, campaignController.pauseCampaign);
router.post('/campaigns/:id/resume', authMiddleware, campaignController.resumeCampaign);
router.post('/campaigns/:id/resend', authMiddleware, campaignController.resendCampaign);
router.post('/campaigns/:id/duplicate', authMiddleware, campaignController.duplicateCampaign);
router.get('/campaigns/:id/status',campaignController.getCampaignStatus);
router.get('/campaigns-stats', campaignController.getCampaignStats);

// ==================== WHATSAPP INTEGRATION ==================== //

// Connection Management
router.get('/whatsapp/qr', authMiddleware, whatsappController.getWhatsAppQR);
router.get('/whatsapp/status', authMiddleware, whatsappController.getWhatsAppStatus);
router.post('/whatsapp/reset', authMiddleware, whatsappController.resetWhatsApp);
router.post('/whatsapp/reconnect', authMiddleware, whatsappController.forceReconnectWhatsApp);
router.post('/whatsapp/refresh-qr', authMiddleware, whatsappController.refreshQRCode);

// Messaging
router.post('/whatsapp/send-single', authMiddleware, whatsappController.sendSingleWhatsApp);
router.post('/whatsapp/send-bulk', authMiddleware, whatsappController.sendBulkWhatsApp);
router.post('/whatsapp/send-media', authMiddleware, whatsappController.sendMediaWhatsApp);

// Data Access
router.get('/whatsapp/contacts', authMiddleware, whatsappController.getWhatsAppContacts);
router.get('/whatsapp/groups', authMiddleware, whatsappController.getWhatsAppGroups);

// ==================== EMAIL INTEGRATION ==================== //

// Gmail Authentication
router.get('/gmail/auth', authMiddleware, campaignController.gmailAuth);
router.get('/gmail/callback', campaignController.gmailCallback); // Note: callback typically doesn't need auth

// Email Messaging
router.post('/email/send-single', authMiddleware, campaignController.sendSingleEmail);
router.post('/email/send-bulk', authMiddleware, campaignController.sendBulkEmail);

// Email Templates
router.get('/gmail/templates', authMiddleware, campaignController.getEmailTemplates);
router.post('/gmail/templates', authMiddleware, campaignController.createEmailTemplate);

// ==================== ANALYTICS & MONITORING ==================== //

// Campaign Analytics
router.get('/analytics/campaign/:id', authMiddleware, campaignController.getCampaignAnalytics);
router.get('/analytics/comprehensive', authMiddleware, campaignController.getComprehensiveAnalytics);

// Channel Statistics
router.get('/analytics/whatsapp/stats', authMiddleware, campaignController.getWhatsAppStats);
router.get('/analytics/email/stats', authMiddleware, campaignController.getGmailStats);

// Reports
router.get('/analytics/reports', authMiddleware, campaignController.generateReports);

// ==================== TRACKING ROUTES ==================== //

// Email Tracking (Public endpoints - no auth required)
router.get('/tracking/pixel', campaignController.trackEmailOpen);
router.get('/tracking/click', campaignController.trackEmailClick);

// ==================== HEALTH & UTILITY ROUTES ==================== //

// System Health
router.get('/health', campaignController.healthCheck);

// Validation Routes
router.post('/validate/phone', authMiddleware, campaignController.validatePhoneNumber);
router.post('/validate/campaign-data', authMiddleware, campaignController.validateCampaignData);

// ==================== BATCH PROCESSING ROUTES ==================== //

router.post('/batch/process', authMiddleware, async (req, res) => {
  try {
    const { items, operation, batchSize = 10, delay = 1000 } = req.body;
    
    if (!items || !operation) {
      return res.status(400).json({
        success: false,
        error: 'Items and operation are required'
      });
    }

    const results = [];
    const batches = [];
    
    // Split items into batches
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchResults = [];
      
      // Process each item in the batch
      for (const item of batch) {
        try {
          let result;
          switch (operation) {
            case 'validate_emails':
              result = { 
                item, 
                valid: campaignController.validateEmail(item),
                type: 'email'
              };
              break;
            case 'validate_phones':
              const phoneAnalysis = whatsappController.analyzePhoneNumber(item);
              result = { 
                item, 
                ...phoneAnalysis,
                type: 'phone'
              };
              break;
            default:
              result = { 
                item, 
                error: 'Unsupported operation type',
                valid: false 
              };
          }
          batchResults.push(result);
        } catch (error) {
          batchResults.push({ 
            item, 
            error: error.message,
            valid: false 
          });
        }
      }
      
      results.push(...batchResults);
      
      // Delay between batches (except the last one)
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    res.json({
      success: true,
      totalProcessed: results.length,
      validCount: results.filter(r => r.valid).length,
      invalidCount: results.filter(r => !r.valid).length,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;