const AwarenessContentEngagement = require('../../models/analytics/Event/ContentEngagement');
const AwarenessCampaign = require('../../models/analytics/Event/Campaign');
const AnalyticsEvent = require('../../models/analytics/Core/Event');

class AwarenessAnalyticsController {
  
  // Track content engagement
  async trackContentEngagement(req, res) {
    try {
      const engagementData = req.body;
      
      // Validate required fields
      if (!engagementData.user_id || !engagementData.session_id || !engagementData.content_id || !engagementData.content_type) {
        return res.status(400).json({
          error: 'user_id, session_id, content_id, and content_type are required'
        });
      }
      
      // Generate engagement ID
      engagementData.engagement_id = `engage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      engagementData.timestamp = new Date(engagementData.timestamp || Date.now());
      
      // Create content engagement
      const engagement = new AwarenessContentEngagement(engagementData);
      await engagement.save();
      
      // Also capture as core event
      await AnalyticsEvent.create({
        event_type: 'content_view',
        event_name: 'content_engagement',
        user_id: engagementData.user_id,
        session_id: engagementData.session_id,
        website_type: 'awareness',
        timestamp: engagementData.timestamp,
        properties: engagementData
      });
      
      res.status(201).json({
        status: 'success',
        engagement_id: engagementData.engagement_id
      });
      
    } catch (error) {
      console.error('Content engagement tracking error:', error);
      res.status(500).json({
        error: 'Failed to track content engagement'
      });
    }
  }
  
  // Track form submission
  async trackFormSubmission(req, res) {
    try {
      const formData = req.body;
      
      // Validate required fields
      if (!formData.user_id || !formData.session_id || !formData.form_type) {
        return res.status(400).json({
          error: 'user_id, session_id, and form_type are required'
        });
      }
      
      // Generate engagement ID
      formData.engagement_id = `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      formData.timestamp = new Date(formData.timestamp || Date.now());
      formData.content_type = 'form_submission';
      
      // Create form submission record
      const formSubmission = new AwarenessContentEngagement(formData);
      await formSubmission.save();
      
      // Also capture as core event
      await AnalyticsEvent.create({
        event_type: 'form_submit',
        event_name: 'form_submission',
        user_id: formData.user_id,
        session_id: formData.session_id,
        website_type: 'awareness',
        timestamp: formData.timestamp,
        properties: formData
      });
      
      res.status(201).json({
        status: 'success',
        engagement_id: formData.engagement_id
      });
      
    } catch (error) {
      console.error('Form submission tracking error:', error);
      res.status(500).json({
        error: 'Failed to track form submission'
      });
    }
  }
  
  // Track campaign performance
  async trackCampaign(req, res) {
    try {
      const campaignData = req.body;
      
      // Validate required fields
      if (!campaignData.user_id || !campaignData.session_id || !campaignData.campaign_id || !campaignData.campaign_name) {
        return res.status(400).json({
          error: 'user_id, session_id, campaign_id, and campaign_name are required'
        });
      }
      
      campaignData.timestamp = new Date(campaignData.timestamp || Date.now());
      
      // Create or update campaign record
      await AwarenessCampaign.findOneAndUpdate(
        { 
          campaign_id: campaignData.campaign_id,
          user_id: campaignData.user_id
        },
        { $set: campaignData },
        { upsert: true, new: true }
      );
      
      res.status(201).json({
        status: 'success',
        campaign_id: campaignData.campaign_id
      });
      
    } catch (error) {
      console.error('Campaign tracking error:', error);
      res.status(500).json({
        error: 'Failed to track campaign'
      });
    }
  }
  
  // Get awareness analytics
  async getAwarenessAnalytics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.timestamp = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      
      // Get awareness metrics
      const [
        totalContentViews,
        totalFormSubmissions,
        totalNewsletterSignups,
        contentByType,
        topContent,
        socialShares
      ] = await Promise.all([
        // Total content views
        AwarenessContentEngagement.countDocuments(dateFilter),
        
        // Total form submissions
        AwarenessContentEngagement.countDocuments({
          ...dateFilter,
          'form_submissions.form_type': { $exists: true }
        }),
        
        // Total newsletter signups
        AwarenessContentEngagement.countDocuments({
          ...dateFilter,
          newsletter_signup: true
        }),
        
        // Content views by type
        AwarenessContentEngagement.aggregate([
          { $match: dateFilter },
          { $group: { _id: '$content_type', views: { $sum: 1 } } },
          { $sort: { views: -1 } }
        ]),
        
        // Top content
        AwarenessContentEngagement.aggregate([
          { $match: dateFilter },
          { $group: { 
            _id: '$content_id', 
            title: { $first: '$content_title' },
            views: { $sum: 1 },
            avg_time: { $avg: '$time_on_content' }
          }},
          { $sort: { views: -1 } },
          { $limit: 10 }
        ]),
        
        // Social shares by platform
        AwarenessContentEngagement.aggregate([
          { $match: { ...dateFilter, 'social_shares.0': { $exists: true } } },
          { $unwind: '$social_shares' },
          { $group: { _id: '$social_shares.platform', shares: { $sum: 1 } } },
          { $sort: { shares: -1 } }
        ])
      ]);
      
      res.json({
        status: 'success',
        data: {
          total_content_views: totalContentViews,
          total_form_submissions: totalFormSubmissions,
          total_newsletter_signups: totalNewsletterSignups,
          content_by_type: contentByType,
          top_content: topContent,
          social_shares: socialShares
        }
      });
      
    } catch (error) {
      console.error('Awareness analytics error:', error);
      res.status(500).json({
        error: 'Failed to fetch awareness analytics'
      });
    }
  }
}

module.exports = new AwarenessAnalyticsController();