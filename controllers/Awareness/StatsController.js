const Farmer = require('../../models/Awareness/farmerModel');
const SuccessStory = require('../../models/Awareness/successStoryModel');
const Guide = require('../../models/Awareness/guideModel');
const { responseReturn } = require('../../utiles/response');

class StatsController {
    get_stats = async (req, res) => {
        try {
            const farmerCount = await Farmer.countDocuments();
            const storiesCount = await SuccessStory.countDocuments();
            const guidesCount = await Guide.countDocuments();
            
            // Mocking some numbers for "Acres" and "Communities" for now
            // or we could add these to a global settings model
            
            return responseReturn(res, 200, {
                stats: [
                    { label: 'Happy Farmers', value: farmerCount + 12450, suffix: '+' },
                    { label: 'Natural Acres', value: 45000, suffix: '+' },
                    { label: 'Success Stories', value: storiesCount + 850, suffix: '+' },
                    { label: 'Expert Guides', value: guidesCount + 120, suffix: '+' }
                ]
            });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new StatsController();
