require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// Mock whatsappClient to capture message
const whatsappClient = require('../utiles/whatsappClient');
whatsappClient.status = 'connected'; // Force connected for test
whatsappClient.sendMessage = async (to, msg) => {
    console.log(`[MOCK WA] Sent to ${to}:\n${msg}\n---`);
};

const aiMasterController = require('../controllers/wear/aiMasterController');
const { dbConnect } = require('../utiles/db');

async function testReport() {
    try {
        console.log('🚀 Connecting to Database...');
        await dbConnect();
        
        console.log('📊 Manually Triggering Supplier Daily Report (DEBUG MODE)...');
        await aiMasterController.generate_supplier_daily_report();
        
        console.log('✅ Test Complete.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Test Failed:', error);
        process.exit(1);
    }
}

testReport();
