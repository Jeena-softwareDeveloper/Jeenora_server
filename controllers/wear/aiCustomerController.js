const { responseReturn } = require('../../utiles/response');
const axios = require('axios');

class AICustomerController {

    // Semantic Search Param Extractor
    // User types: "I want a red wedding saree under 1500" or Tamil/Tanglish
    conversational_search = async (req, res) => {
        try {
            const { text } = req.body;
            if (!text) return responseReturn(res, 400, { error: 'Search text required' });

            const key = process.env.DEEPSEEK_API_KEY || '';
            const client = axios.create({ baseURL: 'https://api.deepseek.com', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' } });

            const prompt = `You are a Smart E-commerce Search Assistant for Jeenora.
Extract structured search parameters from the user's natural language query. Understand Tanglish/Tamil and English natively.
Query: "${text}"

Return exactly this JSON format:
{
  "searchQuery": "main keywords extracted nicely to search our database",
  "category": "extracted clothing category if any or empty string",
  "maxPrice": 1500 (use number if specified, else null),
  "minPrice": 0 (use number if specified, else null),
  "color": "extracted color or empty string",
  "aiSummary": "1 sentence warm response to the user affirming what you are searching for"
}`;
            const completion = await client.post('/chat/completions', {
                model: "deepseek-chat", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }
            });
            const parsed = JSON.parse(completion.data.choices[0].message.content);
            return responseReturn(res, 200, parsed);
        } catch (error) {
            console.error('Semantic Search Error:', error);
            return responseReturn(res, 500, { error: 'Failed to parse search params' });
        }
    }

    // Virtual Personal Stylist
    virtual_stylist = async (req, res) => {
        try {
            const { promptText, contextProduct } = req.body;
            
            const key = process.env.DEEPSEEK_API_KEY || '';
            const client = axios.create({ baseURL: 'https://api.deepseek.com', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' } });

            let prompt = `You are a Jeenora Virtual Personal Stylist.
User Question: "${promptText}"
${contextProduct ? `Currently viewing product: "${contextProduct}"` : ''}

Give a natural, friendly 2-3 sentence style recommendation. Focus on Indian ethnic and modern wear. 
Provide exactly this JSON:
{ 
  "advice": "Your fashion advice here", 
  "suggestedCategoryToBrowse": "e.g., Leggings, Dupattas, Chinos etc." 
}`;
            const completion = await client.post('/chat/completions', {
                model: "deepseek-chat", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }
            });
            const parsed = JSON.parse(completion.data.choices[0].message.content);
            return responseReturn(res, 200, parsed);
        } catch (error) {
            console.error('Stylist Error:', error);
            return responseReturn(res, 500, { error: 'Stylist failed' });
        }
    }

    // AI Size Predictor
    size_predictor = async (req, res) => {
        try {
            const { heightCm, weightKg, preference } = req.body; // preference: "slim", "relaxed", "regular"
            
            const key = process.env.DEEPSEEK_API_KEY || '';
            const client = axios.create({ baseURL: 'https://api.deepseek.com', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' } });

            let prompt = `You are an AI Sizing Expert.
User is ${heightCm} cm tall, weighs ${weightKg} kg, and prefers a ${preference || 'regular'} fit.
What is their optimal clothing size (XS, S, M, L, XL, XXL) in standard Indian sizing?

Return exactly this JSON:
{ 
  "recommendedSize": "M", 
  "explanation": "Short 1-sentence reason why this size fits." 
}`;
            const completion = await client.post('/chat/completions', {
                model: "deepseek-chat", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }
            });
            const parsed = JSON.parse(completion.data.choices[0].message.content);
            return responseReturn(res, 200, parsed);
        } catch (error) {
            console.error('Size Predictor Error:', error);
            return responseReturn(res, 500, { error: 'Prediction failed' });
        }
    }
}

module.exports = new AICustomerController();
