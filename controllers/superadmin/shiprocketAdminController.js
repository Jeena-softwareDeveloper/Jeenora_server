const { responseReturn } = require("../../utils/response");
const shiprocketService = require("../../utils/shiprocketService");

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

    ship_order = async (req, res) => {
        const { shipmentId } = req.body;
        if (!shipmentId) {
            return responseReturn(res, 400, { error: 'Shipment ID is required' });
        }
        try {
            // 1. Fetch available couriers
            const couriers = await shiprocketService.getCouriers(shipmentId);
            if (!couriers || couriers.length === 0) {
                return responseReturn(res, 400, { error: 'No serviceability or available couriers found for this shipment' });
            }
            
            // 2. Select the first available courier
            const recommendedCourier = couriers[0];
            const courierId = recommendedCourier.courier_company_id;
            
            // 3. Assign courier to generate AWB
            const result = await shiprocketService.assignCourier(shipmentId, courierId);
            
            if (result && result.awb_assign_status === 1) {
                return responseReturn(res, 200, { 
                    success: true, 
                    message: 'Courier assigned and AWB generated successfully!',
                    data: result.response.data
                });
            } else {
                return responseReturn(res, 400, { 
                    error: result?.response?.data?.awb_assign_error || 'Failed to assign courier' 
                });
            }
        } catch (error) {
            console.error('❌ Shiprocket Ship Order Error:', error.message);
            return responseReturn(res, 500, { error: 'Internal server error while shipping order' });
        }
    }
}

module.exports = new shiprocketAdminController();
