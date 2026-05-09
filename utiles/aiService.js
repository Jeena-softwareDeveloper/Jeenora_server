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
            console.error('[AI Service] Primary generation failed, trying secondary strategy:', error.message);
            try {
                if (!this.apiKey) return this.getFallbackMessage(target, event, context);

                const prompt = `You are "Jeenora AI", a premium fashion assistant.
                Task: Generate a WhatsApp notification for ${target} for event: "${event}".
                Details: ${JSON.stringify(context)}
                
                Rules:
                1. Use a professional tone in English or Tamil.
                2. Make it EXCITING and PERSONALIZED based on the product purchased.
                3. Use names like "Hi ${context.name || 'Friend'}".
                4. If it's a delivery, tell them to get ready for unboxing!
                5. Keep it short (160 chars). No markdown.`;

                const completion = await this.client.post('/chat/completions', {
                    model: "deepseek-chat",
                    messages: [{ role: "user", content: prompt }],
                    max_tokens: 150
                });

                return completion.data.choices[0].message.content.trim();
            } catch (innerError) {
                console.error('[AI Service] Secondary generation also failed:', innerError.message);
                return this.getFallbackMessage(target, event, context);
            }
        }
    }

    /**
     * AI Address Scrubbing: Fixes spelling and formats address for Shiprocket
     */
    async scrubAddress(addressData) {
        try {
            if (!this.apiKey) return addressData;

            const prompt = `Fix and format the following Indian e-commerce shipping address.
            Address: ${JSON.stringify(addressData)}
            
            Rules:
            1. Correct spelling mistakes in city and state.
            2. Extract and format into: houseNo, area, city, state, pincode.
            3. Use the original data if you are unsure.
            4. Return ONLY a JSON object.`;

            const completion = await this.client.post('/chat/completions', {
                model: "deepseek-chat",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: 'json_object' }
            });

            return JSON.parse(completion.data.choices[0].message.content);
        } catch (error) {
            console.error('[AI Service] Scrubbing error:', error.message);
            return addressData;
        }
    }

    /**
     * AI Smart Courier Selection: Analyzes courier list to pick the best partner
     */
    async pickBestCourier(couriers, orderContext) {
        try {
            if (!this.apiKey || !couriers.length) return couriers[0]?.courier_company_id;

            const prompt = `Analyze the following courier partners and pick the BEST one for an order to ${orderContext.city}.
            Couriers: ${JSON.stringify(couriers.map(c => ({
                id: c.courier_company_id,
                name: c.courier_name,
                rating: c.rating,
                etd: c.etd,
                freight: c.freight_charge
            })))}
            
            Rules:
            1. Prioritize High Rating first.
            2. If ratings are similar, pick the fastest ETD.
            3. Return ONLY the JSON object of the winner.`;

            const completion = await this.client.post('/chat/completions', {
                model: "deepseek-chat",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: 'json_object' }
            });

            const result = JSON.parse(completion.data.choices[0].message.content);
            return result.id;
        } catch (error) {
            return couriers[0]?.courier_company_id;
        }
    }

    /**
     * AI Delay & NDR Assistant: Generates smart resolution messages
     */
    async generateLogisticsSupportMessage(type, context) {
        try {
            if (!this.apiKey) return this.getFallbackMessage('user', type, context);

            const prompt = `You are "Jeenora AI", a helpful logistics assistant.
            Target: Customer (${context.name})
            Type: ${type} (Status: ${context.status})
            Order: #${context.orderId}
            Item: ${context.itemName}

            Task: Generate a ${type === 'delay' ? 'proactive apology' : 'resolution'} message.
            Tone: Helpful, empathetic, and professional.
            Language: Use professional English or Tamil based on the context.
            
            Return only the message text (plain text, no markdown).`;

            const completion = await this.client.post('/chat/completions', {
                model: "deepseek-chat",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 150
            });

            return completion.data.choices[0].message.content.trim();
        } catch (error) {
            return this.getFallbackMessage('user', type, context);
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
