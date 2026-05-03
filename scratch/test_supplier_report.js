require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// Fix paths
const aiMasterController = require('../controllers/wear/aiMasterController');
const { dbConnect } = require('../utiles/db');
const whatsappClient = require('../utiles/whatsappClient');

async function testReport() {
    try {
        console.log('🚀 Connecting to Database...');
        await dbConnect();
        
        console.log('📱 Connecting to WhatsApp (Headless)...');
        await whatsappClient.initialize();
        
        // Wait for connection
        let retries = 0;
        while (whatsappClient.status !== 'connected' && retries < 20) {
            console.log(`⏳ Waiting for WhatsApp... Status: ${whatsappClient.status}`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            retries++;
        }

        if (whatsappClient.status !== 'connected') {
            console.error('❌ WhatsApp failed to connect in time. Check QR if needed.');
        }

        console.log('📊 Manually Triggering Supplier Daily Report...');
        await aiMasterController.generate_supplier_daily_report();
        
        console.log('✅ Test Complete. Check console logs for output.');
        setTimeout(() => process.exit(0), 5000);
    } catch (error) {
        console.error('❌ Test Failed:', error);
        process.exit(1);
    }
}

testReport();
