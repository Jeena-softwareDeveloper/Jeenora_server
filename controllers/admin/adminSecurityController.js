const wearSessionModel = require('../../models/customer/wearSessionModel');
const { responseReturn } = require('../../utils/response');

class adminSecurityController {
    force_logout = async (req, res) => {
        const { userId } = req.params;
        try {
            // Delete all sessions for this user
            await wearSessionModel.deleteMany({ userId });
            responseReturn(res, 200, { message: 'All sessions terminated for user' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    global_force_logout = async (req, res) => {
        try {
            // Clear EVERYTHING - Emergency only
            await wearSessionModel.deleteMany({});
            responseReturn(res, 200, { message: 'GLOBAL PURGE: All platform sessions terminated' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new adminSecurityController();
