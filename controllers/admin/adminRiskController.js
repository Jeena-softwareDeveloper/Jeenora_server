const adminModel = require('../../models/admin/adminModel');
const wearBuyerModel = require('../../models/customer/wearBuyerModel');
const wearLogModel = require('../../models/admin/WearLog');
const { responseReturn } = require('../../utils/response');

class adminRiskController {
    get_risk_report = async (req, res) => {
        try {
            // Mock data or basic aggregation
            const codAbusers = await wearBuyerModel.find({ 
                // Simple logic: more than 3 cancelled orders
                // This is a placeholder, you'd want a real aggregation
            }).limit(10);

            const suspiciousBuyers = await wearBuyerModel.find({
                // Placeholder
            }).limit(10);

            responseReturn(res, 200, {
                codAbusers: codAbusers || [],
                suspiciousBuyers: suspiciousBuyers || []
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_suspicious_logins = async (req, res) => {
        try {
            // Aggregation on logs to find multiple IPs for same user
            const suspicious = await wearLogModel.aggregate([
                { $match: { action: 'LOGIN' } },
                { $group: {
                    _id: "$user",
                    distinctIPs: { $addToSet: "$device.ip" },
                    count: { $sum: 1 }
                }},
                { $project: {
                    _id: 1,
                    ipCount: { $size: "$distinctIPs" },
                    loginCount: "$count"
                }},
                { $match: { ipCount: { $gt: 1 } } },
                { $limit: 20 }
            ]);

            responseReturn(res, 200, { suspicious: suspicious || [] });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    disable_cod = async (req, res) => {
        const { userId } = req.params;
        const { codDisabled } = req.body;
        try {
            await wearBuyerModel.findByIdAndUpdate(userId, { codDisabled: codDisabled !== false });
            responseReturn(res, 200, { message: codDisabled === false ? 'COD privileges restored successfully' : 'COD privileges revoked successfully' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new adminRiskController();

