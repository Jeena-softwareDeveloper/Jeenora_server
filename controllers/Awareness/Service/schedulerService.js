const cron = require('node-cron');
const Campaign = require('../models/Campaign');
const campaignController = require('../controllers/campaignController');

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.startScheduler();
  }

  startScheduler() {
    // Check for due campaigns every minute
    cron.schedule('* * * * *', async () => {
      await this.processDueCampaigns();
    });
  }

  async processDueCampaigns() {
    try {
      const dueCampaigns = await Campaign.getDueCampaigns();
      
      for (const campaign of dueCampaigns) {
        await campaignController.executeCampaign(campaign);
      }
    } catch (error) {
      console.error('Scheduler error:', error);
    }
  }

  async scheduleCampaignJob(campaign) {
    if (campaign.type === 'scheduled') {
      const delay = new Date(campaign.schedule) - new Date();
      if (delay > 0) {
        const timeout = setTimeout(async () => {
          await campaignController.executeCampaign(campaign);
        }, delay);
        
        this.jobs.set(campaign._id.toString(), timeout);
      }
    }
  }

  async cancelCampaignJob(campaignId) {
    const job = this.jobs.get(campaignId.toString());
    if (job) {
      clearTimeout(job);
      this.jobs.delete(campaignId.toString());
    }
  }
}

module.exports = new SchedulerService();