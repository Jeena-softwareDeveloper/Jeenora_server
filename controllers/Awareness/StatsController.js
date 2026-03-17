const Farmer = require('../../models/Awareness/farmerModel');
const SuccessStory = require('../../models/Awareness/successStoryModel');
const Guide = require('../../models/Awareness/guideModel');
const GlobalSetting = require('../../models/Awareness/globalSettingModel');
const { responseReturn } = require('../../utiles/response');

class StatsController {
    get_stats = async (req, res) => {
        try {
            const farmerCount = await Farmer.countDocuments();
            const storiesCount = await SuccessStory.countDocuments();
            const guidesCount = await Guide.countDocuments();
            const baseline = await GlobalSetting.findOne({ key: 'stats_baseline' });
            const data = baseline?.value || {
                farmers: 12450,
                acres: 45000,
                stories: 850,
                guides: 120
            };
            
            return responseReturn(res, 200, {
                stats: [
                    { label: 'Happy Farmers', value: farmerCount + (Number(data.farmers) || 0), suffix: '+' },
                    { label: 'Natural Acres', value: Number(data.acres) || 0, suffix: '+' },
                    { label: 'Success Stories', value: storiesCount + (Number(data.stories) || 0), suffix: '+' },
                    { label: 'Expert Guides', value: guidesCount + (Number(data.guides) || 0), suffix: '+' }
                ]
            });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    get_admin_baseline = async (req, res) => {
        try {
            const baseline = await GlobalSetting.findOne({ key: 'stats_baseline' });
            return responseReturn(res, 200, { baseline: baseline?.value || {} });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    update_baseline = async (req, res) => {
        try {
            const { farmers, acres, stories, guides } = req.body;
            let baseline = await GlobalSetting.findOne({ key: 'stats_baseline' });
            
            if (baseline) {
                baseline.value = { farmers, acres, stories, guides };
                await baseline.save();
            } else {
                baseline = await GlobalSetting.create({
                    key: 'stats_baseline',
                    value: { farmers, acres, stories, guides }
                });
            }
            
            return responseReturn(res, 200, { message: 'Baseline updated' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new StatsController();
