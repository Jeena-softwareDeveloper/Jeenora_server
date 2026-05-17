const { responseReturn } = require('../../utils/response');
const customerOrder = require('../../models/customer/customerOrder');
const wearReviewModel = require('../../models/customer/wearReviewModel');
const wearProductModel = require('../../models/partner/WearProduct');
const axios = require('axios');

class AIAdminController {
    getDeepseekClient = () => {
        const key = process.env.DEEPSEEK_API_KEY || '';
        return axios.create({
            baseURL: 'https://api.deepseek.com',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            }
        });
    }

    // 1. Smart Review Summarizer
    smart_review_summarize = async (req, res) => {
        try {
            const { productId } = req.body;
            let dbReviews = [];
            let productName = "General Product";
            
            if (productId) {
                 dbReviews = await wearReviewModel.find({ productId }).limit(50);
                 const prod = await wearProductModel.findById(productId);
                 if (prod) productName = prod.name;
            } else {
                 dbReviews = await wearReviewModel.find().limit(35); // General fallback
            }

            if (dbReviews.length === 0) {
               return responseReturn(res, 200, { summary: "Not enough reviews found in the database to generate an AI summary." });
            }

            const reviewTexts = dbReviews.map(r => `Rating: ${r.rating}, Comment: ${r.review}`).join(" || ");

            const prompt = `You are an expert E-Commerce AI Data Analyst.
I have a list of recent customer reviews for a product (Product: ${productName}). 
Here are the reviews: [ ${reviewTexts} ]

Analyze these reviews and provide a concise summary.
CRITICAL RULES:
1. Provide 3 to 4 key takeaways in bullet points using '• ' symbol.
2. Group similar praises and complaints. Mention the approximate percentage of users complaining if applicable.
3. Keep the language professional, direct, and under 4 sentences total.
4. ONLY return a JSON response in the following format:
{
  "summary": "your generated text here"
}`;
            
            const client = this.getDeepseekClient();
            const completion = await client.post('/chat/completions', {
                model: "deepseek-chat",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            });

            let aiResponse = JSON.parse(completion.data.choices[0].message.content);
            return responseReturn(res, 200, { summary: aiResponse.summary });
        } catch (error) {
            console.error(error.response?.data || error);
            responseReturn(res, 500, { error: 'AI analysis failed' });
        }
    }

    // 2. Auto Support Reply
    auto_support_reply = async (req, res) => {
        try {
            const { message } = req.body;
            if (!message) return responseReturn(res, 400, { error: "Message is required" });

            const prompt = `You are Jeenora Support, a professional and extremely polite e-commerce customer service AI agent.
A customer has sent the following query: "${message}"

Write a polite, helpful, and concise response addressing their concern. 
1. Apologize if there's an issue.
2. Provide a reassuring Next Step (e.g., ticket raised, check back in 24 hours, hassle-free return).
3. Do NOT use markdown. Plain text only, separated by newlines (\\n).
4. End with "Regards,\\nJeenora Support".

Return ONLY JSON format:
{ "reply": "Generated reply text here" }`;

            const client = this.getDeepseekClient();
            const completion = await client.post('/chat/completions', {
                model: "deepseek-chat",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            });

            let aiResponse = JSON.parse(completion.data.choices[0].message.content);
            return responseReturn(res, 200, { reply: aiResponse.reply });
        } catch (error) {
            responseReturn(res, 500, { error: 'AI draft generation failed' });
        }
    }

    // 3. Fraud Detection Assistant
    fraud_assistant_scan = async (req, res) => {
        try {
            // Fetch recent 10 'pending' or 'unpaid' COD orders to evaluate risk
            const recentOrders = await customerOrder.find({ payment_status: 'unpaid' }).sort({ createdAt: -1 }).limit(10);
            
            if (recentOrders.length === 0) {
                 return responseReturn(res, 200, { alerts: [] });
            }

            const orderDataForAI = recentOrders.map(o => ({
                 id: o._id.toString().substring(0, 8),
                 address: `${o.shippingInfo?.address}, ${o.shippingInfo?.city}, ${o.shippingInfo?.post}`,
                 user: o.shippingInfo?.name,
                 price: o.price
            }));

            const prompt = `You are a strict E-Commerce Fraud and Risk AI System.
Here are recent Cash-on-Delivery (COD) orders: ${JSON.stringify(orderDataForAI)}.
Evaluate each order for potential delivery risk/RTO (Return to Origin). 

Rules to Evaluate Risk:
1. High Price (>3000) on COD increases risk.
2. Incomplete addresses (missing street numbers) increases risk.
3. Pick at least 1 or 2 orders that look slightly suspicious based purely on standard e-commerce patterns (e.g., unusually high amount for COD). Assign a 'riskScore' between 50 and 90. Give a concrete 'reason' and 'action' (e.g., 'Call to Verify').

Return an array 'alerts' in JSON format ONLY:
{
  "alerts": [
      {
         "id": "ord_id",
         "user": "User Name",
         "address": "Address here",
         "riskScore": 85,
         "reason": "High COD value with short address.",
         "action": "Call to Verify"
      }
  ]
}`;

            const client = this.getDeepseekClient();
            const completion = await client.post('/chat/completions', {
                model: "deepseek-chat",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            });

            let aiResponse = JSON.parse(completion.data.choices[0].message.content);
            return responseReturn(res, 200, { alerts: aiResponse.alerts || [] });
        } catch (error) {
            console.error(error.response?.data || error);
            responseReturn(res, 500, { error: 'AI Fraud Scan failed' });
        }
    }

    // 4. AI Category Specs Suggestor
    suggest_category_specs = async (req, res) => {
        try {
            const { categoryName } = req.body;
            if (!categoryName) return responseReturn(res, 400, { error: "Category name is required" });

            const prompt = `You are a Senior E-Commerce Catalog Manager.
An admin is creating a new clothing/wear category named: "${categoryName}".
What are the standard product specifications (Specs) that a supplier MUST fill when adding a product to this category?
Avoid generic things like 'Name' or 'Price'. Focus on product-specific physical traits.

Example for T-Shirt: ["Fabric", "Neck Type", "Sleeve Length", "Fit", "Pattern", "Occasion"]
Example for Sarees: ["Fabric", "Saree Length", "Blouse Pattern", "Border Type", "Print or Pattern Type", "Occasion"]

Provide exactly 5 to 7 highly relevant specification names as a JSON array.

Return ONLY JSON format:
{ "specs": ["Spec 1", "Spec 2", "Spec 3"] }`;

            const client = this.getDeepseekClient();
            const completion = await client.post('/chat/completions', {
                model: "deepseek-chat",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            });

            let aiResponse = JSON.parse(completion.data.choices[0].message.content);
            return responseReturn(res, 200, { specs: aiResponse.specs || [] });
        } catch (error) {
            console.error(error.response?.data || error);
            responseReturn(res, 500, { error: 'AI Spec Suggestion failed' });
        }
    }

    // 5. AI Meta Ads & SEO Content Generator (For Admin Marketing)
    meta_ads_generator = async (req, res) => {
        try {
            const { productName, category, keySellingPoints } = req.body;
            if (!productName) return responseReturn(res, 400, { error: "Product name is required for marketing generation" });

            const prompt = `You are an elite E-Commerce Digital Marketer and SEO Expert.
I am launching a product named "${productName}" (Category: ${category || 'General'}).
Key Selling Points (if any): "${keySellingPoints || 'Best quality, highly durable, trending design'}".

Generate exactly this JSON response containing high-converting Meta Ads copy and website SEO tags:
{
  "facebookAd": {
     "primaryText": "Catchy 2-line hook with emoji.",
     "headline": "Short punchy headline (< 40 chars).",
     "description": "Urgency/Review text under headline."
  },
  "instagramCaption": "Engaging caption with a question, ending with 5 relevant hashtags.",
  "websiteSEO": {
     "metaTitle": "SEO optimized Title (< 60 chars) - Must include product name.",
     "metaDescription": "SEO optimized Description (< 160 chars) focusing on click-through-rate."
  }
}`;

            const client = this.getDeepseekClient();
            const completion = await client.post('/chat/completions', {
                model: "deepseek-chat",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            });

            let aiResponse = JSON.parse(completion.data.choices[0].message.content);
            return responseReturn(res, 200, { marketingPack: aiResponse });
        } catch (error) {
            console.error(error.response?.data || error);
            responseReturn(res, 500, { error: 'AI Marketing Generation failed' });
        }
    }
}

module.exports = new AIAdminController();
