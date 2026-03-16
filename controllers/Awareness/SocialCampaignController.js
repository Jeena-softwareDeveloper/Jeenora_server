const SocialCampaign = require('../../models/Awareness/socialCampaignModel');
const { responseReturn } = require('../../utiles/response');
const cloudinary = require('../../utiles/cloudinary');
const formidable = require('formidable');

class SocialCampaignController {
    // Public get
    get_campaigns = async (req, res) => {
        try {
            const campaigns = await SocialCampaign.find({ isActive: true }).sort({ createdAt: -1 });
            return responseReturn(res, 200, { campaigns });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // Admin get
    get_admin_campaigns = async (req, res) => {
        try {
            const campaigns = await SocialCampaign.find().sort({ createdAt: -1 });
            return responseReturn(res, 200, { campaigns });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    get_campaign_detail = async (req, res) => {
        try {
            const campaign = await SocialCampaign.findById(req.params.id);
            if (!campaign) return responseReturn(res, 404, { error: 'Initiative not found' });
            return responseReturn(res, 200, { campaign });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    add_campaign = async (req, res) => {
        const form = formidable({ multiples: false });
        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 500, { error: err.message });

            const getValue = (val) => Array.isArray(val) ? val[0] : val;
            const title = getValue(fields.title);
            const description = getValue(fields.description);
            const status = getValue(fields.status);
            const startDate = getValue(fields.startDate);
            const endDate = getValue(fields.endDate);
            const location = getValue(fields.location);
            const isHot = getValue(fields.isHot);
            const { image } = files;

            if (!title || !description || !image) {
                return responseReturn(res, 400, { error: 'Title, description and image are required' });
            }

            try {
                const result = await cloudinary.uploader.upload(image.filepath, { folder: 'Awareness Campaigns' });
                const campaign = await SocialCampaign.create({
                    title,
                    description,
                    image: result.secure_url,
                    status: status || 'Active',
                    startDate: startDate ? new Date(startDate) : new Date(),
                    endDate: endDate ? new Date(endDate) : null,
                    location,
                    isHot: isHot === 'true',
                    isActive: true
                });

                return responseReturn(res, 201, { campaign, message: 'Initiative added successfully' });
            } catch (error) {
                return responseReturn(res, 500, { error: error.message });
            }
        });
    }

    update_campaign = async (req, res) => {
        const form = formidable({ multiples: false });
        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 500, { error: err.message });

            try {
                const campaign = await SocialCampaign.findById(req.params.id);
                if (!campaign) return responseReturn(res, 404, { error: 'Not found' });

                const getValue = (val) => Array.isArray(val) ? val[0] : val;
                
                if (fields.title) campaign.title = getValue(fields.title);
                if (fields.description) campaign.description = getValue(fields.description);
                if (fields.status) campaign.status = getValue(fields.status);
                if (fields.startDate) campaign.startDate = new Date(getValue(fields.startDate));
                if (fields.endDate) campaign.endDate = new Date(getValue(fields.endDate));
                if (fields.location) campaign.location = getValue(fields.location);
                if (fields.isHot !== undefined) campaign.isHot = getValue(fields.isHot) === 'true';
                if (fields.isActive !== undefined) campaign.isActive = getValue(fields.isActive) === 'true';

                if (files.image) {
                    const result = await cloudinary.uploader.upload(files.image.filepath, { folder: 'Awareness Campaigns' });
                    campaign.image = result.secure_url;
                }

                await campaign.save();
                return responseReturn(res, 200, { campaign, message: 'Initiative updated' });
            } catch (error) {
                return responseReturn(res, 500, { error: error.message });
            }
        });
    }

    delete_campaign = async (req, res) => {
        try {
            await SocialCampaign.findByIdAndDelete(req.params.id);
            return responseReturn(res, 200, { message: 'Initiative deleted' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    toggle_status = async (req, res) => {
        try {
            const item = await SocialCampaign.findById(req.params.id);
            if (!item) return responseReturn(res, 404, { error: 'Not found' });
            item.isActive = !item.isActive;
            await item.save();
            return responseReturn(res, 200, { item, message: 'Status toggled' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new SocialCampaignController();
