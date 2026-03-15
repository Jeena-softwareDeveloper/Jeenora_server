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
            
            // Fetch baselines from DB
            const baseline = await GlobalSetting.findOne({ key: 'stats_baseline' });
            const data = baseline?.value || {
                farmers: 12450,
                acres: 45000,
                stories: 850,
                guides: 120
            };
            
            return responseReturn(res, 200, {
                stats: [
                    { label: 'Happy Farmers', value: farmerCount + data.farmers, suffix: '+' },
                    { label: 'Natural Acres', value: data.acres, suffix: '+' },
                    { label: 'Success Stories', value: storiesCount + data.stories, suffix: '+' },
                    { label: 'Expert Guides', value: guidesCount + data.guides, suffix: '+' }
                ]
            });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new StatsController();
