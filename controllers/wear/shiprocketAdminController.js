const { responseReturn } = require("../../utiles/response");
const shiprocketService = require("../../utiles/shiprocketService");

class shiprocketAdminController {
    get_wallet_balance = async (req, res) => {
        try {
            const balance = await shiprocketService.getWalletBalance();
            return responseReturn(res, 200, balance);
        } catch (error) {
            return responseReturn(res, 500, { error: 'Failed to fetch wallet balance' });
        }
    }

    get_orders = async (req, res) => {
        const { page, per_page } = req.query;
        try {
            const orders = await shiprocketService.getOrders({ 
                page: page || 1, 
                per_page: per_page || 20 
            });
            return responseReturn(res, 200, orders);
        } catch (error) {
            return responseReturn(res, 500, { error: 'Failed to fetch Shiprocket orders' });
        }
    }

    get_order_logs = async (req, res) => {
        const { shipmentId } = req.params;
        try {
            const logs = await shiprocketService.getOrderLogs(shipmentId);
            return responseReturn(res, 200, logs);
        } catch (error) {
            return responseReturn(res, 500, { error: 'Failed to fetch tracking logs' });
        }
    }
}

module.exports = new shiprocketAdminController();
