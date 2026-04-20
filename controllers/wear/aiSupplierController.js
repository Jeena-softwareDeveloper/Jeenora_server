const { responseReturn } = require('../../utiles/response');
const axios = require('axios');

class AISupplierController {
    generate_ai_recommendation = async (req, res) => {
        try {
            const { productName, category } = req.body;
            if (!productName || !category) {
                return responseReturn(res, 400, { error: 'Product name and category are required' });
            }

            const key = process.env.DEEPSEEK_API_KEY || '';
            const client = axios.create({
                baseURL: 'https://api.deepseek.com',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json'
                }
            });

            const prompt = `You are an expert e-commerce product copywriter. 
Write a highly compelling, premium, and SEO-friendly description for the following product:
Product Name: "${productName}"
Category: "${category}"

CRITICAL RULES:
1. Start with a short 1-2 sentence catchy intro.
2. Directly follow with 3-5 key highlight feature bullet points using the '• ' symbol.
3. Use plain text only! Do NOT use asterisks (*) or markdown for bold/italics. Just pure text and line breaks (\\n).
4. Do not include any HTML tags.

Provide your response strictly in the following JSON format:
{
  "description": "Short catchy intro here.\\n\\n• Feature 1\\n• Feature 2\\n• Feature 3"
}`;

            const completion = await client.post('/chat/completions', {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "You are a specialized e-commerce AI assistant that outputs only raw JSON." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            });

            const rawContent = completion.data.choices[0].message.content;
            let aiResponse;
            try {
                aiResponse = JSON.parse(rawContent);
            } catch (err) {
                 const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
                 if (jsonMatch) aiResponse = JSON.parse(jsonMatch[0]);
                 else throw new Error('Invalid JSON format from AI');
            }

            return responseReturn(res, 200, { description: aiResponse.description });
            
        } catch (error) {
            console.error('Deepseek API Error:', error.response?.data || error.message);
            return responseReturn(res, 500, { error: 'Failed to generate recommendation. Try again later.' });
        }
    }

    // Perfect Price Advisor (Suggests Selling Price)
    advise_price = async (req, res) => {
        try {
            const { productName, category, costPrice } = req.body;
            if (!productName || !category) return responseReturn(res, 400, { error: 'Product name and category required' });

            const key = process.env.DEEPSEEK_API_KEY || '';
            const client = axios.create({ baseURL: 'https://api.deepseek.com', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' } });

            let prompt = `You are an E-Commerce Pricing Strategy Expert.
Suggest a competitive and profitable Selling Price for the following product:
Product Name: "${productName}"
Category: "${category}"
${costPrice ? `Estimated Manufacturing/Source Cost: ₹${costPrice}` : ''}

Provide a reasonable estimate based on current Indian e-commerce market trends. Give a suggested price and a short 1-sentence reason.

Return exactly this JSON format:
{ "suggestedPrice": 499, "reason": "Competitive pricing for basic t-shirts keeping a 30% margin." }`;

            const completion = await client.post('/chat/completions', {
                model: "deepseek-chat", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }
            });

            const parsed = JSON.parse(completion.data.choices[0].message.content);
            return responseReturn(res, 200, parsed);
        } catch (error) {
            console.error('AI Price Advisor Error:', error);
            return responseReturn(res, 500, { error: 'Price advisor failed' });
        }
    }

    // Auto SEO Keywords/Tags
    generate_seo_tags = async (req, res) => {
        try {
            const { productName } = req.body;
            if (!productName) return responseReturn(res, 400, { error: 'Product name required' });

            const key = process.env.DEEPSEEK_API_KEY || '';
            const client = axios.create({ baseURL: 'https://api.deepseek.com', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' } });

            let prompt = `You are an SEO Expert for an Indian E-Commerce platform.
Generate 5 to 7 highly searched comma-separated keywords/tags for the product: "${productName}".
Do not include '#' symbols.

Return exactly this JSON format:
{ "tags": "tag1, tag2, tag3" }`;

            const completion = await client.post('/chat/completions', {
                model: "deepseek-chat", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }
            });

            const parsed = JSON.parse(completion.data.choices[0].message.content);
            return responseReturn(res, 200, { tags: parsed.tags });
        } catch (error) {
            console.error('AI SEO Tags Error:', error);
            return responseReturn(res, 500, { error: 'SEO tags generation failed' });
        }
    }

    // Smart Review Reply for Supplier
    smart_review_reply = async (req, res) => {
        try {
            const { reviewText, rating } = req.body;
            if (!reviewText) return responseReturn(res, 400, { error: 'Review text required' });

            const key = process.env.DEEPSEEK_API_KEY || '';
            const client = axios.create({ baseURL: 'https://api.deepseek.com', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' } });

            let tone = rating <= 2 ? "empathetic, apologetic, and solution-focused" : "appreciative, happy, and welcoming";

            let prompt = `You are representing a polite, professional seller on an E-Commerce platform.
A customer just left a ${rating}-Star review saying: "${reviewText}".

Write a short, professional response (max 3 sentences) directly addressing the customer.
Tone should be ${tone}.
No markdown. No HTML. Just plain text.

Return exactly this JSON format:
{ "reply": "Your generated reply here." }`;

            const completion = await client.post('/chat/completions', {
                model: "deepseek-chat", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }
            });

            const parsed = JSON.parse(completion.data.choices[0].message.content);
            return responseReturn(res, 200, { reply: parsed.reply });
        } catch (error) {
            console.error('AI Smart Reply Error:', error);
            return responseReturn(res, 500, { error: 'Smart reply failed' });
        }
    }
}

module.exports = new AISupplierController();
