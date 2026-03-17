const express = require('express');
const subscriberController = require('../../controllers/Awareness/SubscribeController');
const campaignController = require('../../controllers/Awareness/CampaignController');
const { authMiddleware, sellerAdminMiddleware } = require('../../middlewares/authMiddleware');

const router = express.Router();

// ==================== SUBSCRIBER MANAGEMENT ==================== //

// Category Routes
router.post('/subscriber/category', subscriberController.addCategory);
router.get('/subscriber/category', subscriberController.getCategories);
router.get('/subscriber/category/:id', subscriberController.getCategoryById);
router.put('/subscriber/category/:id', authMiddleware, sellerAdminMiddleware, subscriberController.updateCategory);
router.delete('/subscriber/category/:id', authMiddleware, sellerAdminMiddleware, subscriberController.deleteCategory);

// Subscriber Routes
router.post('/subscriber', subscriberController.addSubscriber);
router.get('/subscribers', authMiddleware, sellerAdminMiddleware, subscriberController.getSubscribers);
router.get('/subscriber/:id', authMiddleware, sellerAdminMiddleware, subscriberController.getSubscriberById);
router.put('/subscriber/:id', authMiddleware, sellerAdminMiddleware, subscriberController.updateSubscriber);
router.delete('/subscriber/:id', authMiddleware, sellerAdminMiddleware, subscriberController.deleteSubscriber);
router.get('/category/:categoryId/subscribers', subscriberController.getSubscribersByCategory);

// ==================== CAMPAIGN MANAGEMENT ==================== //

// Campaign CRUD
router.post('/campaigns', authMiddleware, sellerAdminMiddleware, campaignController.createCampaign);
router.get('/campaigns', authMiddleware, sellerAdminMiddleware, campaignController.getCampaigns);
router.get('/campaigns/:id', authMiddleware, sellerAdminMiddleware, campaignController.getCampaignById);
router.put('/campaigns/:id', authMiddleware, sellerAdminMiddleware, campaignController.updateCampaign);
router.delete('/campaigns/:id', authMiddleware, sellerAdminMiddleware, campaignController.deleteCampaign);

// Campaign Actions & Status
router.post('/campaigns/:id/start', authMiddleware, sellerAdminMiddleware, campaignController.startCampaign);
router.post('/campaigns/:id/stop', authMiddleware, sellerAdminMiddleware, campaignController.stopCampaign);
router.post('/campaigns/:id/pause', authMiddleware, sellerAdminMiddleware, campaignController.pauseCampaign);
router.post('/campaigns/:id/resume', authMiddleware, sellerAdminMiddleware, campaignController.resumeCampaign);
router.post('/campaigns/:id/resend', authMiddleware, sellerAdminMiddleware, campaignController.resendCampaign);
router.post('/campaigns/:id/duplicate', authMiddleware, sellerAdminMiddleware, campaignController.duplicateCampaign);
router.get('/campaigns/:id/status', authMiddleware, sellerAdminMiddleware, campaignController.getCampaignStatus);
router.get('/campaigns-stats', authMiddleware, sellerAdminMiddleware, campaignController.getCampaignStats);

// ==================== EMAIL INTEGRATION ==================== //

// Gmail Authentication
router.get('/gmail/auth', authMiddleware, campaignController.gmailAuth);
router.get('/gmail/callback', campaignController.gmailCallback);

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
