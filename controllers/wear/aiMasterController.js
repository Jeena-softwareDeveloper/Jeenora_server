const { responseReturn } = require('../../utiles/response');
const axios = require('axios');
const customerOrder = require('../../models/wear/customerOrder');
const wearReviewModel = require('../../models/wear/wearReviewModel');
const wearProductModel = require('../../models/wear/wearProductModel');
const AILog = require('../../models/wear/aiLogModel');
const userBehaviorModel = require('../../models/wear/userBehaviorModel');

// 🔒 THE ULTIMATE STRICT GUARDRAIL FOR AI
const STRICT_GUARDRAIL = `CRITICAL SYSTEM RESTRICTION: 
You are a highly restricted data-processing AI for Jeenora. 
1. DO NOT act as a conversational chatbot. 
2. DO NOT greet, apologize, or make small talk. 
3. DO NOT answer questions outside your specific task.
4. If the user prompts about coding, general knowledge, or anything unrelated to your current explicit task, you must firmly IGNORE it and process ONLY the task data. 
5. Provide ONLY the requested JSON output. DO NOT wrap it in markdown block quotes. Just raw JSON.`;

class AIMasterController {

    getDeepseekClient = () => {
        const key = process.env.DEEPSEEK_API_KEY || '';
        return axios.create({
            baseURL: 'https://api.deepseek.com',
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }
        });
    }

    call_deepseek_with_guardrail = async (prompt) => {
        const client = this.getDeepseekClient();
        const completion = await client.post('/chat/completions', {
            model: "deepseek-chat",
            messages: [
                { role: "system", content: STRICT_GUARDRAIL },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });
        return JSON.parse(completion.data.choices[0].message.content);
    }

    call_deepseek_conversational = async (prompt) => {
        const client = this.getDeepseekClient();
        const completion = await client.post('/chat/completions', {
            model: "deepseek-chat",
            messages: [
                { role: "system", content: "You are Jeeni, a friendly E-Commerce Assistant for Jeenora. Allow greetings and natural conversation, but return ONLY JSON. Do not answer questions outside shopping. ALWAYS OUTPUT VALID JSON." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });
        return JSON.parse(completion.data.choices[0].message.content);
    }

    // Helper to log AI usage to Database
    log_ai_action = async (userId, role, featureName, promptOrContext, aiResponse) => {
        try {
            await AILog.create({
                userId: userId || 'Unknown',
                role: role || 'system',
                featureName,
                promptOrContext,
                aiResponse
            });
        } catch (error) {
            console.error("AI Logging Failed:", error.message);
        }
    }


    /* ========================================================
       1. ADMIN DASHBOARD AI FEATURES
       ======================================================== */

    // Admin: AI Logs Fetcher
    get_ai_logs = async (req, res) => {
        try {
            const logs = await AILog.find().sort({ createdAt: -1 }).limit(100);
            return responseReturn(res, 200, { logs });
        } catch (error) {
            return responseReturn(res, 500, { error: 'Failed to fetch AI logs' });
        }
    }

    smart_review_summarize = async (req, res) => {
        try {
            const { productId } = req.body;
            let dbReviews = []; let productName = "General Product";
            
            if (productId) {
                 dbReviews = await wearReviewModel.find({ productId }).limit(50);
                 const prod = await wearProductModel.findById(productId);
                 if (prod) productName = prod.name;
            } else {
                 dbReviews = await wearReviewModel.find().limit(35);
            }

            if (dbReviews.length === 0) return responseReturn(res, 200, { summary: "Not enough reviews found." });

            const reviewTexts = dbReviews.map(r => `Rating: ${r.rating}, Comment: ${r.review}`).join(" || ");
            const prompt = `TASK: Summarize these e-commerce product reviews. Product: ${productName}. Reviews: [ ${reviewTexts} ]. RETURN ONLY JSON: {"summary": "..."}`;
            
            let aiResponse = await this.call_deepseek_with_guardrail(prompt);

            await this.log_ai_action(req.id, req.role, 'Smart Review Summarize', `Summarizing ${dbReviews.length} reviews for ${productName}`, aiResponse);
            return responseReturn(res, 200, { summary: aiResponse.summary });
        } catch (error) {
            responseReturn(res, 500, { error: 'AI analysis failed' });
        }
    }

    auto_support_reply = async (req, res) => {
        try {
            const { message } = req.body;
            if (!message) return responseReturn(res, 400, { error: "Message is required" });

            const prompt = `TASK: Write polite customer support reply. Customer query: "${message}". RETURN ONLY JSON: {"reply": "..."}`;
            let aiResponse = await this.call_deepseek_with_guardrail(prompt);

            await this.log_ai_action(req.id, req.role, 'Auto Support Reply', `Customer query: ${message}`, aiResponse);
            return responseReturn(res, 200, { reply: aiResponse.reply });
        } catch (error) {
            responseReturn(res, 500, { error: 'AI draft failed' });
        }
    }

    fraud_assistant_scan = async (req, res) => {
        try {
            const recentOrders = await customerOrder.find({ payment_status: 'unpaid' }).sort({ createdAt: -1 }).limit(10);
            if (recentOrders.length === 0) return responseReturn(res, 200, { alerts: [] });

            // Privacy Guard: Never send exact customer PII to external AI. Send metadata indicators.
            const orderDataForAI = recentOrders.map(o => ({ 
                id: o._id.toString().substring(0,8), 
                addressLength: o.shippingInfo?.address?.length || 0,
                city: o.shippingInfo?.city || 'Unknown',
                price: o.price 
            }));
            const prompt = `TASK: Evaluate COD orders for fraud/RTO risk. Data: ${JSON.stringify(orderDataForAI)}. High price > 3000 or very short addressLength < 10 is risky. RETURN ONLY JSON: {"alerts": [{"id":"..","action":".."}]}`;

            let aiResponse = await this.call_deepseek_with_guardrail(prompt);

            await this.log_ai_action(req.id, req.role, 'Fraud Assistant Scan', 'Scanned recent 10 COD orders', aiResponse);
            return responseReturn(res, 200, { alerts: aiResponse.alerts || [] });
        } catch (error) {
            responseReturn(res, 500, { error: 'AI Fraud Scan failed' });
        }
    }

    suggest_category_specs = async (req, res) => {
        try {
            const { categoryName } = req.body;
            const prompt = `TASK: Suggest exactly 4-6 physical spec attributes (e.g. Fabric, Fit, Style) for clothing category "${categoryName}".
            
            STRICT RULES:
            1. Suggest MINIMUM 4 and MAXIMUM 6 attributes.
            2. PRIORITIZE 'select' (dropdown) type for most attributes (at least 70-80% should be dropdowns).
            3. Each 'select' attribute must have 4-6 common Indian market options.
            4. Only use 'text' type if absolutely necessary (e.g. Weight or Measurements).
            
            RETURN ONLY JSON: 
            {
              "specs": [
                { "name": "Fabric", "type": "select", "options": ["Cotton", "Silk", "Rayon", "Polyester"] },
                { "name": "Fit", "type": "select", "options": ["Regular", "Slim", "Oversized", "Skinny"] }
              ]
            }`;
            
            let aiResponse = await this.call_deepseek_with_guardrail(prompt);

            await this.log_ai_action(req.id, req.role, 'Category Specs Suggest', `Category: ${categoryName}`, aiResponse);
            return responseReturn(res, 200, { specs: aiResponse.specs || [] });
        } catch (error) {
            responseReturn(res, 500, { error: 'AI Spec Suggest failed' });
        }
    }

    generate_category_ui_style = async (req, res) => {
        try {
            const { categoryName } = req.body;
            const seed = Math.random().toString(36).substring(7); // Force variety
            const prompt = `TASK: Generate a unique, premium UI card style for category "${categoryName}".
            SEED: ${seed} (Use this to ensure high variety from previous designs).
            
            STRICT RULES:
            - Do NOT repeat the same boring white background.
            - Explore: Vibrant Gradients (e.g. from-rose-500 to-orange-500), Dark Mode (bg-gray-900), Glassmorphism (bg-white/10 backdrop-blur), or Neon Borders.
            - Ensure "textColor" is readable (e.g. text-white if dark bg, text-gray-900 if light bg).
            
            RETURN ONLY JSON:
            {
              "containerClass": "Tailwind classes here... (must include height info like h-full)",
              "accentColor": "HEX color code for small UI bits",
              "textColor": "Tailwind text color class"
            }`;
            
            let aiResponse = await this.call_deepseek_with_guardrail(prompt);
            await this.log_ai_action(req.id, req.role, 'AI UI Style Generator', `Category: ${categoryName}`, aiResponse);
            return responseReturn(res, 200, aiResponse);
        } catch (error) {
            console.error(error);
            responseReturn(res, 500, { error: 'AI Design Generation failed' });
        }
    }

    meta_ads_generator = async (req, res) => {
        try {
            const { productName, category, keySellingPoints } = req.body;
            const prompt = `TASK: Generate specific Meta Ads marketing copy and SEO tags for product "${productName}" (${category}). RETURN ONLY JSON: {"facebookAd":{"primaryText":"", "headline":"", "description":""}, "instagramCaption": "", "websiteSEO":{"metaTitle":"", "metaDescription":""}}`;
            
            let aiResponse = await this.call_deepseek_with_guardrail(prompt);
            await this.log_ai_action(req.id, req.role, 'Meta Ads Generator', `Product: ${productName}`, aiResponse);
            return responseReturn(res, 200, { marketingPack: aiResponse });
        } catch (error) {
            responseReturn(res, 500, { error: 'AI Marketing failed' });
        }
    }

    inventory_forecaster = async (req, res) => {
        try {
            // Fetch products running low on stock to evaluate
            const lowStockProducts = await wearProductModel.find({ stock: { $lt: 20 } }).select('name stock category price brand').limit(20);
            if(lowStockProducts.length === 0) return responseReturn(res, 200, { forecast: "All products have sufficient stock. No immediate orders needed." });

            const inventoryData = lowStockProducts.map(p => ({
                id: p._id.toString().substring(0,8), name: p.name, stock: p.stock, category: p.category
            }));

            const prompt = `TASK: You are an E-Commerce Supply Chain Officer. Analyze this low stock data: ${JSON.stringify(inventoryData)}. Suggest what needs to be restocked immediately based on upcoming Indian festivals/trends, and give a short action plan. RETURN ONLY JSON: {"forecast": "Actionable summary here...", "recommendedOrders": [{"name":"product name", "suggestedQuantityToOrder": 100}]}`;
            
            let aiResponse = await this.call_deepseek_with_guardrail(prompt);
            await this.log_ai_action(req.id, req.role, 'Inventory Forecaster', 'Scanned low stock items', aiResponse);
            return responseReturn(res, 200, aiResponse);
        } catch (error) {
            console.error(error);
            responseReturn(res, 500, { error: 'Inventory forecast failed' });
        }
    }

    /* ========================================================
       2. SUPPLIER DASHBOARD AI FEATURES
       ======================================================== */

    generate_ai_recommendation = async (req, res) => {
        try {
            const { productName, category } = req.body;
            const prompt = `TASK: Write premium product description for "${productName}" (${category}). Max 4 bullets. RETURN ONLY JSON: {"description": "intro\\n\\n• bull 1"}`;
            
            let aiResponse = await this.call_deepseek_with_guardrail(prompt);
            await this.log_ai_action(req.id, req.role, 'Product Description AI', `Product: ${productName}`, aiResponse);
            return responseReturn(res, 200, { description: aiResponse.description });
        } catch (error) {
            responseReturn(res, 500, { error: 'Failed recommendation' });
        }
    }

    advise_price = async (req, res) => {
        try {
            const { productName, category, costPrice } = req.body;
            const prompt = `TASK: Suggest profitable selling price for "${productName}" (${category}). Known Cost Price: ${costPrice}. Maintain Indian market trends. RETURN ONLY JSON: {"suggestedPrice": 499, "reason": "why"}`;
            
            let aiResponse = await this.call_deepseek_with_guardrail(prompt);
            await this.log_ai_action(req.id, req.role, 'Price Advisor', `Product: ${productName}, Cost: ${costPrice}`, aiResponse);
            return responseReturn(res, 200, aiResponse);
        } catch (error) {
            responseReturn(res, 500, { error: 'Price advisor failed' });
        }
    }

    generate_seo_tags = async (req, res) => {
        try {
            const { productName } = req.body;
            const prompt = `TASK: Generate 5 comma-separated highly searched keywords (no hashtags) for: "${productName}". RETURN ONLY JSON: {"tags": "a,b,c"}`;
            
            let aiResponse = await this.call_deepseek_with_guardrail(prompt);
            await this.log_ai_action(req.id, req.role, 'SEO Tags Generator', `Target: ${productName}`, aiResponse);
            return responseReturn(res, 200, { tags: aiResponse.tags });
        } catch (error) {
            responseReturn(res, 500, { error: 'SEO tags failed' });
        }
    }

    smart_review_reply = async (req, res) => {
        try {
            const { reviewText, rating } = req.body;
            const prompt = `TASK: Write professional seller reply to customer review. Rating given: ${rating}/5. Review given: "${reviewText}". RETURN ONLY JSON: {"reply": "..."}`;
            
            let aiResponse = await this.call_deepseek_with_guardrail(prompt);
            await this.log_ai_action(req.id, req.role, 'Smart Review Reply', `Rating: ${rating}, Review: ${reviewText}`, aiResponse);
            return responseReturn(res, 200, { reply: aiResponse.reply });
        } catch (error) {
            responseReturn(res, 500, { error: 'Smart reply failed' });
        }
    }

    /* ========================================================
       3. CUSTOMER STOREFRONT AI FEATURES
       ======================================================== */

    conversational_search = async (req, res) => {
        try {
            const { text } = req.body;
            const prompt = `TASK: Extract search filters from query (understands Tanglish/Tamil/English). Query: "${text}". RETURN ONLY JSON: {"searchQuery": "clean text", "category": "clothing type", "maxPrice": 1500, "aiSummary": "1 sentence warm confirmation"}`;
            
            let aiResponse = await this.call_deepseek_with_guardrail(prompt);
            await this.log_ai_action(req.id, req.role, 'Semantic Search', `Query: ${text}`, aiResponse);
            return responseReturn(res, 200, aiResponse);
        } catch (error) {
            responseReturn(res, 500, { error: 'Search parsing failed' });
        }
    }

    virtual_stylist = async (req, res) => {
        try {
            const { promptText, contextProduct } = req.body;
            const prompt = `TASK: Act as fashion stylist. Q: "${promptText}". Product in view: "${contextProduct}". Keep advice to 2 sentences. RETURN ONLY JSON: {"advice": "...", "suggestedCategoryToBrowse": "..."}`;
            
            let aiResponse = await this.call_deepseek_with_guardrail(prompt);
            await this.log_ai_action(req.id, req.role, 'Personal Stylist', `Q: ${promptText}, Ctx: ${contextProduct}`, aiResponse);
            return responseReturn(res, 200, aiResponse);
        } catch (error) {
            responseReturn(res, 500, { error: 'Stylist failed' });
        }
    }

    size_predictor = async (req, res) => {
        try {
            const { heightCm, weightKg, preference } = req.body;
            const prompt = `TASK: Predict clothing size (XS to XXL). Height: ${heightCm}cm. Weight: ${weightKg}kg. Fit Pref: ${preference}. RETURN ONLY JSON: {"recommendedSize": "M", "explanation": "..."}`;
            
            let aiResponse = await this.call_deepseek_with_guardrail(prompt);
            await this.log_ai_action(req.id, req.role, 'Size Predictor', `Params: ${heightCm}cm, ${weightKg}kg, ${preference}`, aiResponse);
            return responseReturn(res, 200, aiResponse);
        } catch (error) {
            responseReturn(res, 500, { error: 'Prediction failed' });
        }
    }

    get_support_languages = async (req, res) => {
        try {
            const languages = [
                "English", "Tanglish", "தமிழ் (Tamil)", "हिन्दी (Hindi)", 
                "తెలుగు (Telugu)", "ಕನ್ನಡ (Kannada)", "മലയാളം (Malayalam)", 
                "मराठी (Marathi)", "বাংলা (Bengali)", "ગુજરાતી (Gujarati)",
                "ਪੰਜਾਬી (Punjabi)", "ଓଡ଼ିଆ (Odia)", "অসমীয়া (Assamese)", 
                "اردو (Urdu)", "संस्कृत (Sanskrit)", "सिंधी (Sindhi)",
                "कोंकणी (Konkani)", "बोगो (Bodo)", "नेपाली (Nepali)"
            ];
            return responseReturn(res, 200, { languages });
        } catch(error) {
            console.error(error);
            responseReturn(res, 500, { error: 'Failed to fetch languages' });
        }
    }

    ai_customer_support = async (req, res) => {
        try {
            const { message, chatHistory, agentName = 'Aditi' } = req.body;
            const formattedHistory = Array.isArray(chatHistory) ? chatHistory.map(m => `${m.role}: ${m.content}`).join(" | ") : "";

            const prompt = `TASK: You are ${agentName}, a human Customer Support Executive at Jeenora. 
Recent Chat History: [${formattedHistory}]
User Current Message: "${message}"

RULES:
1. NEVER mention that you are an AI, virtual assistant, chatbot, or automated system. You are a real human named ${agentName}.
2. Empathize and respond conversationally to queries regarding Refunds, Returns, Shipping delays, Product issues, or Order Status.
3. Keep it brief, professional, and friendly.
4. If they ask about order status, ask them to check the 'My Orders' section in their Profile.
5. If the issue is extremely complex, tell them you will have a senior executive look into it and reply via email at support@jeenora.com.

RETURN ONLY JSON:
{
  "replyText": "your human-like support response"
}`;

            let aiResponse = await this.call_deepseek_conversational(prompt);

            const finalPayload = {
                replyText: aiResponse.replyText
            };

            await this.log_ai_action(req.id, req.role, 'AI Customer Support', `Customer asked: ${message}`, finalPayload);
            return responseReturn(res, 200, finalPayload);
        } catch(error) {
            console.error(error);
            responseReturn(res, 500, { error: 'Support Agent Failed' });
        }
    }
    track_behavior = async (req, res) => {
        const { productId, category, referrer, viewDuration } = req.body;
        const userId = req.id || 'Guest';

        try {
            await userBehaviorModel.create({
                userId,
                productId,
                category,
                referrer,
                viewDuration
            });
            return responseReturn(res, 200, { message: 'Behavior tracked' });
        } catch (error) {
            console.error(error);
            return responseReturn(res, 500, { error: 'Tracking failed' });
        }
    }

    get_personalized_recommendations = async (req, res) => {
        const userId = req.id || 'Guest';

        try {
            // 1. Get user's last 5 viewed categories
            const history = await userBehaviorModel.find({ userId })
                .sort({ timestamp: -1 })
                .limit(5);

            const viewedCategories = [...new Set(history.map(h => h.category))];

            if (viewedCategories.length === 0) {
                // Return top products if no history
                const products = await wearProductModel.find({}).limit(8);
                return responseReturn(res, 200, { products });
            }

            // 2. AI Prediction for Cross-Category
            const prompt = `User has recently viewed these categories: [${viewedCategories.join(", ")}]. 
            Task: Suggest 2 complementary categories they might like. 
            Example: If they view Jeans, suggest T-Shirt.
            Return ONLY JSON: { "suggestedCategories": ["cat1", "cat2"] }`;

            let aiResponse = await this.call_deepseek_conversational(prompt);
            const allInterests = [...viewedCategories, ...(aiResponse.suggestedCategories || [])];

            // 3. Fetch products from these categories
            const products = await wearProductModel.find({
                category: { $in: allInterests }
            }).limit(12);

            return responseReturn(res, 200, { 
                products,
                reason: `Based on your interest in ${viewedCategories[0]}`
            });

        } catch (error) {
            console.error(error);
            return responseReturn(res, 500, { error: 'Recommendation failed' });
        }
    }
}

module.exports = new AIMasterController();
