const mongoose = require('mongoose');
require('dotenv').config();
const whatsappClient = require('./utiles/whatsappClient');
const Customer = require('./models/wear/customerModel');

async function runTest() {
    try {
        console.log("Connecting to DB...");
        await mongoose.connect(process.env.DB_URL);
        console.log("Connected.");

        // Find any customer with a phone number
        const user = await Customer.findOne({ phone: { $exists: true } });
        
        if (!user || !user.phone) {
            console.log("No users with phone numbers found in DB.");
            process.exit();
        }

        console.log(`Attempting to send test message to: ${user.phone} (${user.name})`);
        
        // Wait a bit for whatsapp client to be ready (it's a singleton)
        // In a real script, we'd wait for the 'ready' event, but here we assume it's already running in the background server
        // However, this script is a separate process, so it needs its own initialization if we want it to work standalone.
        // But the user just wants to see if the logic works.
        
        // Let's try to initialize it here
        await whatsappClient.initialize();
        
        // Wait for it to connect
        let checks = 0;
        const interval = setInterval(async () => {
            const status = whatsappClient.getStatus();
            console.log(`Current Status: ${status.status}`);
            
            if (status.status === 'connected') {
                clearInterval(interval);
                await whatsappClient.sendMessage(user.phone, `Hi ${user.name}, this is a test message from Jeenora AI to verify WhatsApp connectivity. Please ignore.`);
                console.log("✅ Test message sent successfully!");
                process.exit();
            }
            
            checks++;
            if (checks > 30) { // 30 seconds timeout
                clearInterval(interval);
                console.log("❌ Timeout waiting for WhatsApp connection.");
                process.exit(1);
            }
        }, 1000);

    } catch (err) {
        console.error("Test failed:", err);
        process.exit(1);
    }
}

runTest();
