const axios = require('axios');
require('dotenv').config();

const DEEPSEEK_API_KEY = "sk-cabe8fe2501e41e5a84e3b7678ce4f06";

const test = async () => {
    try {
        const client = axios.create({
            baseURL: 'https://api.deepseek.com',
            headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' }
        });
        
        const completion = await client.post('/chat/completions', {
            model: "deepseek-chat",
            messages: [
                { role: "system", content: "You are a helpful assistant. RETURN ONLY JSON." },
                { role: "user", content: "Suggest 3 fruits. RETURN ONLY JSON: {\"fruits\": []}" }
            ],
            response_format: { type: "json_object" }
        });
        
        console.log('Response:', JSON.stringify(completion.data, null, 2));
    } catch (error) {
        console.error('Error Message:', error.message);
        if (error.response) {
            console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
};

test();
