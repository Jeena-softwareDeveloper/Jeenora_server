const { responseReturn } = require("../../utiles/response");
const whatsappClient = require("../../utiles/whatsappClient");

class wearWhatsAppController {
    getStatus = async (req, res) => {
        try {
            const data = whatsappClient.getStatus();
            responseReturn(res, 200, data);
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    initialize = async (req, res) => {
        try {
            const { force } = req.body;
            // Kick off initialization in background (socket will handle updates)
            whatsappClient.initialize(force === true);
            responseReturn(res, 200, { message: 'WhatsApp initialization started' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    logout = async (req, res) => {
        try {
            await whatsappClient.logout();
            responseReturn(res, 200, { message: 'WhatsApp logged out successfully' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    testMessage = async (req, res) => {
        try {
            const { phoneNumber, message } = req.body;
            if (!phoneNumber || !message) {
                return responseReturn(res, 400, { error: 'Phone number and message are required' });
            }

            await whatsappClient.sendMessage(phoneNumber, message);
            responseReturn(res, 200, { message: 'Test message sent successfully' });
        } catch (error) {
            console.error('[WhatsApp Controller] Test message error:', error);
            responseReturn(res, 500, { error: error.message || 'Failed to send test message' });
        }
    }
}

module.exports = new wearWhatsAppController();
