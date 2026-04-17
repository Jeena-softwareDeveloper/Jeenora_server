const adminModel = require('../../models/adminModel');
const wearBuyerModel = require('../../models/wear/wearBuyerModel');
const wearLogModel = require('../../models/wear/wearLogModel');
const { responseReturn } = require('../../utiles/response');

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
        try {
            // Placeholder: update a flag in the user model
            await wearBuyerModel.findByIdAndUpdate(userId, { codDisabled: true });
            responseReturn(res, 200, { message: 'COD privileges revoked' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new adminRiskController();
