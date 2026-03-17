const router = require('express').Router();
const socialCampaignController = require('../../controllers/Awareness/SocialCampaignController');
const { authMiddleware, sellerAdminMiddleware } = require('../../middlewares/authMiddleware');

// Public
router.get('/campaigns', socialCampaignController.get_campaigns);
router.get('/campaigns/:id', socialCampaignController.get_campaign_detail);

// Admin
router.get('/admin/campaigns', authMiddleware, sellerAdminMiddleware, socialCampaignController.get_admin_campaigns);
router.post('/admin/campaigns/add', authMiddleware, sellerAdminMiddleware, socialCampaignController.add_campaign);
router.put('/admin/campaigns/update/:id', authMiddleware, sellerAdminMiddleware, socialCampaignController.update_campaign);
router.delete('/admin/campaigns/delete/:id', authMiddleware, sellerAdminMiddleware, socialCampaignController.delete_campaign);
// Dashboard Aliases
router.post('/campaign-add', authMiddleware, sellerAdminMiddleware, socialCampaignController.add_campaign);
router.put('/campaign-update/:id', authMiddleware, sellerAdminMiddleware, socialCampaignController.update_campaign);
router.delete('/campaign/:id', authMiddleware, sellerAdminMiddleware, socialCampaignController.delete_campaign);
router.patch('/campaign/toggle-status/:id', authMiddleware, sellerAdminMiddleware, socialCampaignController.toggle_status);

module.exports = router;
