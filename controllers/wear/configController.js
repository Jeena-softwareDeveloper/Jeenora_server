const adminSettingsModel = require("../../models/adminSettingsModel");
const { responseReturn } = require("../../utiles/response");

class configController {
    get_initial_data = async (req, res) => {
        try {
            const languages = [
                { id: 'en', name: 'English', native: 'English' },
                { id: 'ta', name: 'Tamil', native: 'தமிழ்' },
                { id: 'hi', name: 'Hindi', native: 'हिन्दी' },
                { id: 'te', name: 'Telugu', native: 'తెలుగు' },
                { id: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
                { id: 'ml', name: 'Malayalam', native: 'മലയാളം' }
            ];

            const versioning = {
                currentVersion: '1.0.0',
                minRequiredVersion: '1.0.0',
                forceUpdate: false,
                androidLink: 'https://play.google.com/store/apps/details?id=com.jeenora.app',
                iosLink: 'https://apps.apple.com/app/jeenora/id123456789'
            };

            // Fetch Wear Settings
            const wearSetting = await adminSettingsModel.findOne({ settingKey: 'wear_config' });
            const wearConfig = wearSetting ? wearSetting.settingValue : {};

            // Ensure default structure
            if (wearConfig.min_online_payment_amount === undefined) {
                wearConfig.min_online_payment_amount = 0;
            }

            // Fetch common business types
            const businessTypes = [
                { id: 'retail', name: 'Retailer', description: 'Sell directly to customers' },
                { id: 'wholesale', name: 'Wholesaler', description: 'Sell in bulk to other businesses' },
                { id: 'manufacturer', name: 'Manufacturer', description: 'Produce and sell your own goods' }
            ];

            responseReturn(res, 200, {
                languages,
                versioning,
                wearConfig,
                businessTypes,
                success: true
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new configController();
