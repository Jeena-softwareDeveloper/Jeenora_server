const axios = require('axios');
require('dotenv').config();

const GROQ_API_KEY = "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";

const test = async () => {
    try {
        const client = axios.create({
            baseURL: 'https://api.groq.com/openai/v1',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }
        });
        
        const completion = await client.post('/chat/completions', {
            model: "llama-3.3-70b-versatile",
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
