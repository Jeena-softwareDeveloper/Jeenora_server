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

    get_ndr_reports = async (req, res) => {
        try {
            const reports = await shiprocketService.getNDRList(req.query);
            return responseReturn(res, 200, reports);
        } catch (error) {
            return responseReturn(res, 500, { error: 'Failed to fetch NDR reports' });
        }
    }

    get_rto_risk = async (req, res) => {
        const { mobile } = req.params;
        try {
            const risk = await shiprocketService.getRtoRisk(mobile);
            return responseReturn(res, 200, risk);
        } catch (error) {
            return responseReturn(res, 500, { error: 'Failed to assess RTO risk' });
        }
    }

    generate_label = async (req, res) => {
        const { shipmentIds } = req.body;
        try {
            const label = await shiprocketService.generateLabel(shipmentIds);
            return responseReturn(res, 200, label);
        } catch (error) {
            return responseReturn(res, 500, { error: 'Failed to generate label' });
        }
    }

    track_awb = async (req, res) => {
        const { awb } = req.params;
        try {
            const tracking = await shiprocketService.trackAWB(awb);
            return responseReturn(res, 200, tracking);
        } catch (error) {
            return responseReturn(res, 500, { error: 'Failed to track AWB' });
        }
    }
}

module.exports = new shiprocketAdminController();
