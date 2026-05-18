const adminSettingsModel = require('../../models/admin/adminSettingsModel');
const { responseReturn } = require('../../utils/response');

class adminSettingsController {
    // Get a setting by key
    getSetting = async (req, res) => {
        const { key } = req.params;
        try {
            let setting = await adminSettingsModel.findOne({ settingKey: key });
            if (!setting) {
                if (key === 'menuDisplayMode') {
                    setting = {
                        settingKey: 'menuDisplayMode',
                        settingValue: {},
                        description: 'Controls how each menu group is displayed (grouped with parent or flat list)'
                    };
                } else if (key === 'wear_config') {
                    setting = {
                        settingKey: 'wear_config',
                        settingValue: {},
                        description: 'Jeenora Wear Core configuration settings'
                    };
                } else {
                    return responseReturn(res, 404, { error: 'Setting not found' });
                }
            }
            responseReturn(res, 200, { setting });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }


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

    updateMenuDisplayMode = async (req, res) => {
        const { menuGroupSettings } = req.body;
        try {
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

