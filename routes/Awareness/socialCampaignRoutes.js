const router = require('express').Router();
const socialCampaignController = require('../../controllers/Awareness/SocialCampaignController');
const { authMiddleware, adminMiddleware } = require('../../middlewares/authMiddleware');

// Public
router.get('/campaigns', socialCampaignController.get_campaigns);
router.get('/campaigns/:id', socialCampaignController.get_campaign_detail);

// Admin
router.get('/admin/campaigns', authMiddleware, adminMiddleware, socialCampaignController.get_admin_campaigns);
router.post('/admin/campaigns/add', authMiddleware, adminMiddleware, socialCampaignController.add_campaign);
router.put('/admin/campaigns/update/:id', authMiddleware, adminMiddleware, socialCampaignController.update_campaign);
router.delete('/admin/campaigns/delete/:id', authMiddleware, adminMiddleware, socialCampaignController.delete_campaign);
router.patch('/admin/campaigns/toggle-status/:id', authMiddleware, adminMiddleware, socialCampaignController.toggle_status);

module.exports = router;
