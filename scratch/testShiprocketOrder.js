const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const shiprocketService = require('../utiles/shiprocketService');

const testOrder = async () => {
    console.log('🚀 Starting Shiprocket Order Creation Test...');
    
    // 1. Check Wallet Balance first to see if API is alive
    try {
        const balance = await shiprocketService.getWalletBalance();
        console.log('💰 Wallet Balance Info:', JSON.stringify(balance.data, null, 2));
    } catch (err) {
        console.error('❌ Could not fetch wallet balance. Authentication might be failing.');
    }

    // 2. Prepare Dummy Order Data
    const dummyOrder = {
        order_id: `TEST-${Date.now()}`,
        order_date: new Date().toISOString().split('T')[0],
        pickup_location: process.env.SHIPROCKET_DEFAULT_PICKUP_PINCODE || "624001",
        billing_customer_name: "Test",
        billing_last_name: "User",
        billing_address: "123 Test Lane",
        billing_city: "Dindigul",
        billing_pincode: "624001",
        billing_state: "Tamil Nadu",
        billing_country: "India",
        billing_email: "test@example.com",
        billing_phone: "9876543210",
        shipping_is_billing: true,
        order_items: [
            {
                name: "Test Product",
                sku: "TP-001",
                units: 1,
                selling_price: 100
            }
        ],
        payment_method: "Prepaid",
        sub_total: 100,
        length: 10,
        breadth: 10,
        height: 10,
        weight: 0.5
    };

    console.log('📦 Creating Adhoc Order with ID:', dummyOrder.order_id);

    try {
        const response = await shiprocketService.createOrder(dummyOrder);
        console.log('✅ SUCCESS! Shiprocket Response:');
        console.log(JSON.stringify(response, null, 2));
    } catch (error) {
        console.log('❌ FAILURE! Error Details:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('Message:', error.message);
        }
    }
};

testOrder();
