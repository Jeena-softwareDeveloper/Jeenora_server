const whatsappClient = require('./utiles/whatsappClient');

// Mocking the client and status for testing logic
whatsappClient.status = 'connected';
whatsappClient.client = {
    sendMessage: async (chatId, message) => {
        console.log(`[MOCK] Sending to: ${chatId}`);
        console.log(`[MOCK] Message: ${message}`);
        return true;
    }
};

async function test() {
    console.log("--- Testing WhatsApp Number Formatting Logic ---");
    
    const testNumbers = [
        "9876543210",        // Should become 919876543210@c.us
        "+91 98765 43210",   // Should become 919876543210@c.us
        "919876543210",      // Should stay 919876543210@c.us
        "12345"              // Should become 12345@c.us (too short for auto-91)
    ];

    for (const num of testNumbers) {
        console.log(`\nInput: ${num}`);
        try {
            await whatsappClient.sendMessage(num, "Test Message from Jeenora AI");
        } catch (err) {
            console.error("Error:", err.message);
        }
    }
}

test();
