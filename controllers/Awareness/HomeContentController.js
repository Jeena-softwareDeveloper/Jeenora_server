const HomeContent = require('../../models/Awareness/homeContentModel');
const { responseReturn } = require('../../utiles/response');

class HomeContentController {
    get_content = async (req, res) => {
        const { key } = req.params;
        try {
            const content = await HomeContent.findOne({ sectionKey: key });
            return responseReturn(res, 200, { content });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    get_all_content = async (req, res) => {
        try {
            const contents = await HomeContent.find();
            return responseReturn(res, 200, { contents });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // Admin tool to update
    update_content = async (req, res) => {
        const { key } = req.params;
        try {
            const content = await HomeContent.findOneAndUpdate(
                { sectionKey: key },
                req.body,
                { upsert: true, new: true }
            );
            return responseReturn(res, 200, { content, message: 'Updated successfully' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new HomeContentController();
