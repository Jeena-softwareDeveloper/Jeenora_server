const adminSettingsModel = require('../models/adminSettingsModel');
const { responseReturn } = require('../utiles/response');

class adminSettingsController {
    // Get a setting by key
    getSetting = async (req, res) => {
        const { key } = req.params;
        try {
            const setting = await adminSettingsModel.findOne({ settingKey: key });
            if (!setting) {
                return responseReturn(res, 404, { error: 'Setting not found' });
            }
            responseReturn(res, 200, { setting });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Get all settings
    getAllSettings = async (req, res) => {
        try {
            const settings = await adminSettingsModel.find({});
            responseReturn(res, 200, { settings });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Update or create a setting
    updateSetting = async (req, res) => {
        const { settingKey, settingValue, description } = req.body;
        try {
            const setting = await adminSettingsModel.findOneAndUpdate(
                { settingKey },
                { settingValue, description },
                { new: true, upsert: true }
            );
            responseReturn(res, 200, { message: 'Setting updated successfully', setting });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Update menu display mode for specific menu groups
    updateMenuDisplayMode = async (req, res) => {
        const { menuGroupSettings } = req.body;
        try {
            // menuGroupSettings should be an object like:
            // { "awareness": "grouped", "hire": "flat", "products": "grouped" }

            const setting = await adminSettingsModel.findOneAndUpdate(
                { settingKey: 'menuDisplayMode' },
                {
                    settingValue: menuGroupSettings,
                    description: 'Controls how each menu group is displayed (grouped with parent or flat list)'
                },
                { new: true, upsert: true }
            );

            responseReturn(res, 200, { message: 'Menu display mode updated successfully', setting });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new adminSettingsController();
