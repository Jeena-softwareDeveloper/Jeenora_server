const axios = require('axios');
require('dotenv').config({ path: 'd:/access/Latest/Jeenora_Server/.env' });

async function testShiprocketConnection() {
    console.log('--- Shiprocket Connectivity Test ---');
    console.log(`Email: ${process.env.SHIPROCKET_EMAIL}`);
    
    try {
        console.log('🔄 Attempting to login to Shiprocket...');
        const response = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
            email: process.env.SHIPROCKET_EMAIL,
            password: process.env.SHIPROCKET_PASSWORD
        });

        if (response.data && response.data.token) {
            console.log('✅ Shiprocket Connection Successful!');
            console.log('Token Received:', response.data.token.substring(0, 20) + '...');
            
            // Try fetching wallet balance as a secondary check
            console.log('🔄 Checking Wallet Balance...');
            const walletResponse = await axios.get('https://apiv2.shiprocket.in/v1/external/wallet/data', {
                headers: {
                    'Authorization': `Bearer ${response.data.token}`
                }
            });
            console.log('✅ Wallet Balance Fetch Successful!');
            console.log('Balance Data:', JSON.stringify(walletResponse.data, null, 2));
        } else {
            console.log('❌ Login failed: No token received.');
            console.log('Response:', response.data);
        }
    } catch (error) {
        console.error('❌ Shiprocket Connection Failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error Message:', error.message);
        }
    }
}

testShiprocketConnection();
