const StaticContent = require('../../models/hire/staticContentModel');
const { responseReturn } = require("../../utiles/response");

class StaticContentController {
    getContent = async (req, res) => {
        const { page } = req.params;
        try {
            const content = await StaticContent.findOne({ page });
            responseReturn(res, 200, content || { page, content: {} });
        } catch (error) {
            console.error(error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    getAllContent = async (req, res) => {
        try {
            const contents = await StaticContent.find();
            responseReturn(res, 200, contents);
        } catch (error) {
            console.error(error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    updateContent = async (req, res) => {
        const { page } = req.params;
        const { content } = req.body;
        try {
            let item = await StaticContent.findOne({ page });
            if (item) {
                item.content = content;
                await item.save();
            } else {
                item = await StaticContent.create({ page, content });
            }
            responseReturn(res, 200, { message: 'Content updated successfully', item });
        } catch (error) {
            console.error(error);
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new StaticContentController();
