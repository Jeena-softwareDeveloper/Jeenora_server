const CreditSetting = require('../../models/hire/creditSettingModel');
const { responseReturn } = require("../../utiles/response");

class CreditSettingController {
    getSettings = async (req, res) => {
        try {
            const settings = await CreditSetting.getSettings();
            responseReturn(res, 200, settings);
        } catch (error) {
            console.error(error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    updateSettings = async (req, res) => {
        try {
            const settings = await CreditSetting.getSettings();

            // Dynamic update of all fields sent in body
            const fields = [
                'jobApplyCost', 'jobApplyEnabled', 'jobApplyType',
                'messageSendCost', 'messageSendEnabled', 'messageSendType',
                'resumeEditCost', 'resumeEditEnabled', 'resumeEditType',
                'supportInquiryCost', 'supportInquiryEnabled', 'supportInquiryType',
                'chatEnableCost', 'chatEnableEnabled', 'chatEnableType',
                'minPurchaseCredits', 'perCreditCostINR', 'creditsComingSoon', 'initialFreeCredits'
            ];

            fields.forEach(field => {
                if (req.body[field] !== undefined) {
                    settings[field] = req.body[field];
                }
            });

            await settings.save();
            responseReturn(res, 200, { message: 'Credit settings updated successfully', settings });
        } catch (error) {
            console.error(error);
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new CreditSettingController();
