const axios = require('axios');

class AIService {
    constructor() {
        this.apiKey = process.env.DEEPSEEK_API_KEY || '';
        this.client = axios.create({
            baseURL: 'https://api.deepseek.com',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Generate a personalized notification message using AI
     * @param {string} target - 'user' or 'supplier'
     * @param {string} event - e.g. 'order_placed', 'application_approved', 'order_shipped'
     * @param {Object} context - Data to help AI generate the message (name, orderId, shopName, etc.)
     * @returns {Promise<string>} - The generated message
     */
    async generateNotificationMessage(target, event, context) {
        try {
            if (!this.apiKey) {
                console.warn('[AI Service] No DeepSeek API Key found. Using fallback templates.');
                return this.getFallbackMessage(target, event, context);
            }

            const prompt = `You are a professional and friendly e-commerce notification assistant for "Jeenora".
Generate a short, engaging, and premium notification message for a ${target} regarding the following event: "${event}".

Context Details:
${JSON.stringify(context, null, 2)}

Rules:
1. Keep it under 160 characters (suitable for SMS/WhatsApp).
2. Use a ${target === 'supplier' ? 'professional' : 'friendly and exciting'} tone.
3. Personalize it using the details provided (like names, order numbers, or shop names).
4. Do NOT use placeholders like [Name]. Use the actual data from context.
5. Do NOT use markdown. Just plain text.
6. If the target is a supplier, use their Shop Name if available.

Return only the message text.`;

            const completion = await this.client.post('/chat/completions', {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "You are a professional notification writer for an e-commerce platform called Jeenora." },
                    { role: "user", content: prompt }
                ],
                max_tokens: 100
            });

            return completion.data.choices[0].message.content.trim();
        } catch (error) {
            console.error('[AI Service] Generation error:', error.message);
            return this.getFallbackMessage(target, event, context);
        }
    }

    getFallbackMessage(target, event, context) {
        const { name, orderId, shopName, status } = context;
        switch (event) {
            case 'order_placed':
                return target === 'supplier' 
                    ? `New Order! You have received a new order #${orderId}. Please check your dashboard.`
                    : `Hi ${name}, your Jeenora order #${orderId} has been placed successfully!`;
            case 'application_approved':
                return `Congratulations ${shopName || name}! Your Jeenora Supplier application has been approved. Start selling now!`;
            case 'application_rejected':
                return `Hi ${shopName || name}, your Jeenora Supplier application was not approved at this time. Please check your dashboard for details.`;
            case 'order_shipped':
                return `Hi ${name}, your order #${orderId} has been shipped and is on its way!`;
            default:
                return `New update from Jeenora: ${event} ${status || ''}`;
        }
    }
}

module.exports = new AIService();
