const axios = require('axios');

class ShiprocketService {
    constructor() {
        this.token = null;
        this.tokenExpiry = null;
    }

    async getToken() {
        // If token exists and not expired (with 1 min buffer), return it
        if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry - 60000) {
            return this.token;
        }

        try {
            const response = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
                email: process.env.SHIPROCKET_EMAIL,
                password: process.env.SHIPROCKET_PASSWORD
            });

            this.token = response.data.token;
            // Assuming token is valid for typical 24 hours, but we update every call if needed
            // Shiprocket tokens usually last 10 days, but we can safely check every hour or so
            this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); 
            return this.token;
        } catch (error) {
            console.error('❌ Shiprocket Auth Error:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with Shiprocket');
        }
    }

    async getEDD(pickup_pincode, delivery_pincode) {
        try {
            const token = await this.getToken();
            
            // Shiprocket Courier Serviceability API for EDD
            const response = await axios.get('https://apiv2.shiprocket.in/v1/external/courier/serviceability/', {
                params: {
                    pickup_postcode: pickup_pincode,
                    delivery_postcode: delivery_pincode,
                    weight: 0.5, // Default weight for estimation
                    cod: 1 // Assume COD is possible for estimation
                },
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data && response.data.status === 200) {
                // Get the best EDD from available couriers
                const couriers = response.data.data.available_courier_companies;
                if (couriers && couriers.length > 0) {
                    // Sort by delivery date (estimated_delivery_date is usually "2024-03-05 21:00:00")
                    const bestCourier = couriers.sort((a, b) => 
                        new Date(a.estimated_delivery_date) - new Date(b.estimated_delivery_date)
                    )[0];
                    
                    return bestCourier.estimated_delivery_date;
                }
            }
            return null;
        } catch (error) {
            console.error('❌ Shiprocket EDD Error:', error.response?.data || error.message);
            return null; // Return null to allow fallback in controller
        }
    }

    async getShippingRate(pickup_pincode, delivery_pincode, weight = 0.5, cod = 0, declared_value = 500) {
        try {
            const token = await this.getToken();
            const response = await axios.get('https://apiv2.shiprocket.in/v1/external/courier/serviceability/', {
                params: {
                    pickup_postcode: pickup_pincode,
                    delivery_postcode: delivery_pincode,
                    weight: weight,
                    cod: cod,
                    declared_value: declared_value
                },
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data && response.data.status === 200) {
                const couriers = response.data.data.available_courier_companies;
                if (couriers && couriers.length > 0) {
                    // Get the cheapest courier rate
                    const bestCourier = couriers.sort((a, b) => a.freight_charge - b.freight_charge)[0];
                    return {
                        rate: bestCourier.freight_charge,
                        courier: bestCourier.courier_name,
                        edd: bestCourier.estimated_delivery_date,
                        cod_charges: bestCourier.cod_charges || 0
                    };
                }
            }
            return null;
        } catch (error) {
            console.error('❌ Shiprocket Rate Error:', error.response?.data || error.message);
            return null;
        }
    }

    async getWalletBalance() {
        try {
            const token = await this.getToken();
            const response = await axios.get('https://apiv2.shiprocket.in/v1/external/wallet/data', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('❌ Shiprocket Wallet Error:', error.response?.data || error.message);
            throw error;
        }
    }

    async getOrders(params = { per_page: 20, page: 1 }) {
        try {
            const token = await this.getToken();
            const response = await axios.get('https://apiv2.shiprocket.in/v1/external/orders', {
                params,
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('❌ Shiprocket Orders Fetch Error:', error.response?.data || error.message);
            throw error;
        }
    }

    async getOrderLogs(shipmentId) {
        try {
            const token = await this.getToken();
            const response = await axios.get(`https://apiv2.shiprocket.in/v1/external/courier/track/shipment/${shipmentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('❌ Shiprocket Tracking Logs Error:', error.response?.data || error.message);
            throw error;
        }
    }

    async createOrder(orderData) {
        try {
            const token = await this.getToken();
            const response = await axios.post('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', orderData, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('❌ Shiprocket Create Order Error:', error.response?.data || error.message);
            throw error;
        }
    }

    async generateLabel(shipmentIds) {
        try {
            const token = await this.getToken();
            const response = await axios.post('https://apiv2.shiprocket.in/v1/external/courier/generate/label', {
                shipment_id: shipmentIds
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('❌ Shiprocket Label Error:', error.response?.data || error.message);
            throw error;
        }
    }

    async getNDRList(params = {}) {
        try {
            const token = await this.getToken();
            const response = await axios.get('https://apiv2.shiprocket.in/v1/external/ndr/all', {
                params,
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('❌ Shiprocket NDR Fetch Error:', error.response?.data || error.message);
            throw error;
        }
    }

    async getRtoRisk(mobileNumber) {
        try {
            const token = await this.getToken();
            // This is a specialized API, endpoint might vary based on plan, using standard track prediction if available
            const response = await axios.get('https://apiv2.shiprocket.in/v1/external/courier/track/rto-prediction', {
                params: { mobile: mobileNumber },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            // If API not available on plan, return neutral risk
            return { risk_score: 0, status: 'unknown' };
        }
    }

    async trackAWB(awb) {
        try {
            const token = await this.getToken();
            const response = await axios.get(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awb}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('❌ Shiprocket AWB Track Error:', error.response?.data || error.message);
            throw error;
        }
    }

    async getCouriers(shipmentId) {
        try {
            const token = await this.getToken();
            const response = await axios.get(`https://apiv2.shiprocket.in/v1/external/courier/serviceability/?shipment_id=${shipmentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data.data.available_courier_companies;
        } catch (error) {
            console.error('[SHIPROCKET] Courier fetch error:', error.message);
            return [];
        }
    }

    async assignCourier(shipmentId, courierId) {
        try {
            const token = await this.getToken();
            const response = await axios.post('https://apiv2.shiprocket.in/v1/external/courier/assign/awb', {
                shipment_id: shipmentId,
                courier_id: courierId
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('[SHIPROCKET] Courier assign error:', error.message);
            return null;
        }
    }
    async getPickupLocations() {
        try {
            const token = await this.getToken();
            const response = await axios.get('https://apiv2.shiprocket.in/v1/external/settings/company/pickup', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('[SHIPROCKET] Pickup fetch error:', error.message);
            return null;
        }
    }
}

module.exports = new ShiprocketService();
