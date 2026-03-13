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
            console.log('🔄 Authenticaton with Shiprocket...');
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
}

module.exports = new ShiprocketService();
