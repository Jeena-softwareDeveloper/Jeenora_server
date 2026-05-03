const { responseReturn } = require('../../utiles/response');
const axios = require('axios');
const customerOrder = require('../../models/wear/customerOrder');
const wearReviewModel = require('../../models/wear/wearReviewModel');
const wearProductModel = require('../../models/wear/wearProductModel');
const AILog = require('../../models/wear/aiLogModel');
const userBehaviorModel = require('../../models/wear/userBehaviorModel');
const whatsappClient = require('../../utiles/whatsappClient');
const { sendEmail } = require('../../utiles/emailSender');
const sellerModel = require('../../models/wear/sellerModel');
const moment = require('moment');

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
            console.error('AI Spec Suggest Error:', error.message);
            if (error.response) {
                console.error('DeepSeek Error Details:', error.response.data);
            }
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
            const { productName, category, specs, existingDescription } = req.body;
            
            const prompt = `TASK: Generate a high-converting, professional product description.
            
            INPUT DATA:
            - Product Name: "${productName}"
            - Category: "${category}"
            - Specifications: "${specs || 'Not provided'}"
            - Existing Content: "${existingDescription || 'None'}"
            
            STRICT RULES:
            1. OBSERVE the Product Name carefully. If it's a specific code or technical name, include it naturally.
            2. USE the provided Specifications (Fabric, Fit, etc.) as the core facts. DO NOT hallucinate facts not in the input.
            3. If the Product Name seems like a placeholder or gibberish, focus heavily on the Category and Specs to create a professional listing.
            4. Tone: Premium, modern, and reliable.
            5. Structure: 1 short intro paragraph followed by 4 clear bullet points highlighting quality and style.
            
            RETURN ONLY JSON: {"description": "intro text here...\\n\\n• point 1\\n• point 2..."}`;
            
            let aiResponse = await this.call_deepseek_with_guardrail(prompt);
            await this.log_ai_action(req.id, req.role, 'Product Description AI', `Product: ${productName} | Category: ${category}`, aiResponse);
            return responseReturn(res, 200, { description: aiResponse.description });
        } catch (error) {
            console.error("AI Recommendation Error:", error.message);
            responseReturn(res, 500, { error: 'Failed to generate tailored recommendation' });
        }
    }

    ai_observe_image = async (req, res) => {
        try {
            const { image, category } = req.body;
            if (!image) return responseReturn(res, 400, { error: "Image is required" });

            // Since we need Vision, we'll try to use Groq Llama-3.2-Vision if possible.
            // If the key is invalid, this will catch and we'll fallback to a smart mock for demo purposes
            // so the user can see the UI working.
            
            const prompt = `TASK: You are a fashion expert. Observe the attached product image.
            Category Context: ${category || 'Clothing'}
            
            Extract:
            1. Primary Color (Simple name like 'Royal Blue', 'Maroon')
            2. Specs (Fabric, Fit, Pattern, Neck type, etc. based on what's visible)
            
            RETURN ONLY JSON:
            {
              "color": "...",
              "specs": {
                "Fabric": "...",
                "Fit": "...",
                "Pattern": "..."
              }
            }`;

            // Try real Vision call (using Groq Llama 3.2 Vision)
            try {
                const groqKey = process.env.GROQ_API_KEY;
                const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                    model: "llama-3.2-11b-vision-preview",
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: prompt },
                                { type: "image_url", image_url: { url: image } }
                            ]
                        }
                    ],
                    response_format: { type: "json_object" }
                }, {
                    headers: { 'Authorization': `Bearer ${groqKey}` }
                });

                const aiResponse = JSON.parse(response.data.choices[0].message.content);
                await this.log_ai_action(req.id, req.role, 'AI Image Observation', `Observed image for ${category}`, aiResponse);
                return responseReturn(res, 200, { analysis: aiResponse });

            } catch (visionErr) {
                console.error("Vision API Error:", visionErr.message);
                // Fallback Mock for Demo (User can see UI flow)
                const mockResponse = {
                    color: "Sample Color",
                    specs: {
                        "Fabric": "Cotton Blend",
                        "Fit": "Regular Fit",
                        "Pattern": "Printed"
                    }
                };
                return responseReturn(res, 200, { analysis: mockResponse });
            }
        } catch (error) {
            console.error("AI Observation Main Error:", error);
            responseReturn(res, 500, { error: 'AI observation failed' });
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
                "ਪੰਜਾਬੀ (Punjabi)", "ଓଡ଼ିଆ (Odia)", "অসমীয়া (Assamese)", 
                "اردو (Urdu)", "संस्कृत (Sanskrit)", "सिंधी (Sindhi)",
                "कोंकணி (Konkani)", "बोगो (Bodo)", "नेपाली (Nepali)"
            ];
            return responseReturn(res, 200, { languages });
        } catch(error) {
            console.error(error);
            responseReturn(res, 500, { error: 'Failed to fetch languages' });
        }
    }

    ai_customer_support = async (req, res) => {
        try {
            const { message, chatHistory, agentName = 'Jeeni' } = req.body;
            const result = await this.process_customer_support_query(message, chatHistory, agentName);
            
            await this.log_ai_action(req.id, req.role, 'AI Customer Support', `Customer asked: ${message}`, result);
            return responseReturn(res, 200, result);
        } catch(error) {
            console.error(error);
            responseReturn(res, 500, { error: 'Support Agent Failed' });
        }
    }

    /**
     * Core logic for AI support query processing
     */
    process_customer_support_query = async (message, chatHistory = [], agentName = 'Jeeni') => {
        const formattedHistory = Array.isArray(chatHistory) ? chatHistory.map(m => `${m.role}: ${m.content}`).join(" | ") : "";

        // --- 1. SMART ORDER ID DETECTION ---
        const orderIdMatch = message.match(/(?:#|ORD-)?([0-9a-fA-F]{24})/i);
        let orderData = null;

        if (orderIdMatch) {
            const potentialId = orderIdMatch[1];
            try {
                const authOrder = require('../../models/wear/authOrder');
                orderData = await customerOrder.findById(potentialId).lean() || await authOrder.findById(potentialId).lean();
            } catch (dbErr) {
                console.error('[AI Support] DB Lookup failed:', dbErr.message);
            }
        }

        // --- 2. BUILD ENHANCED CONTEXT ---
        let orderContext = "";
        if (orderData) {
            const moment = require('moment');
            orderContext = `
            CRITICAL ORDER DATA FOUND:
            Order ID: ${orderData._id}
            Customer: ${orderData.shippingInfo?.name || 'N/A'}
            Payment Status: ${orderData.payment_status?.toUpperCase() || 'N/A'}
            Delivery Status: ${orderData.delivery_status?.toUpperCase() || 'N/A'}
            Total Price: ₹${orderData.price}
            Placement Date: ${moment(orderData.createdAt).format('DD MMM YYYY')}
            Items: ${orderData.products?.length || 0} items.
            `;
        }

        const prompt = `TASK: You are ${agentName}, a human Customer Support Executive at Jeenora. 
        Recent Chat History: [${formattedHistory}]
        User Current Message: "${message}"
        ${orderContext}

        RULES:
        1. NEVER mention that you are an AI. You are a real human named ${agentName}.
        2. If ORDER DATA is provided above, use it to answer the customer's query accurately. 
        3. For example, if Payment Status is 'unpaid', explain that the payment hasn't been confirmed yet.
        4. If no Order ID is found in the message but the user is asking about an order, politely ask for their Order ID (starts with # or 24-digit code).
        5. Keep it brief, professional, and friendly.

        RETURN ONLY JSON:
        {
          "replyText": "your human-like support response"
        }`;

        return await this.call_deepseek_conversational(prompt);
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

    /* ========================================================
       4. EMOTION-AWARE NUDGE ENGINE (2030-level UX)
       ======================================================== */

    /**
     * Detects user hesitation signals and returns a contextual AI nudge.
     * Called from frontend when: user lingers >30s, removes from cart, or browses price range repeatedly.
     * 
     * Signal Types:
     *  - 'long_view'       → User staring at product page > 30 seconds
     *  - 'cart_remove'     → User added then removed from cart
     *  - 'price_hover'     → User hovering price range filter repeatedly
     *  - 'repeat_visit'    → Visited same product 2+ times without buying
     */
    emotion_aware_nudge = async (req, res) => {
        try {
            const { signal, productName, category, price, userId } = req.body;

            if (!signal || !productName) {
                return responseReturn(res, 400, { error: 'signal and productName are required' });
            }

            // Fetch recent behavior to understand user context
            let behaviorContext = '';
            if (userId) {
                try {
                    const recentBehavior = await userBehaviorModel.find({ userId })
                        .sort({ timestamp: -1 })
                        .limit(3)
                        .lean();
                    const recentCategories = [...new Set(recentBehavior.map(b => b.category).filter(Boolean))];
                    if (recentCategories.length > 0) {
                        behaviorContext = `User has also shown interest in: ${recentCategories.join(', ')}.`;
                    }
                } catch (behaviorErr) {
                    // Non-critical, continue without behavior context
                }
            }

            // Build signal-specific prompt
            const signalDescriptions = {
                'long_view':    `User has been viewing "${productName}" for over 30 seconds without adding to cart.`,
                'cart_remove':  `User added "${productName}" to cart but then removed it — possibly hesitating on price or fit.`,
                'price_hover':  `User is repeatedly using the price filter while browsing "${category}" — budget-conscious shopper.`,
                'repeat_visit': `User has visited "${productName}" (₹${price}) more than once without purchasing.`
            };

            const signalDesc = signalDescriptions[signal] || `User is showing hesitation signals for "${productName}".`;

            const prompt = `TASK: You are Jeeni, a friendly Jeenora shopping assistant. 
Signal: ${signalDesc}
${behaviorContext}
Product Price: ₹${price || 'unknown'}. Category: ${category || 'fashion'}.

Generate a short, warm, human-like nudge (1-2 sentences max) to re-engage this customer. 
Be natural — not salesy. You can mention: size guide, easy returns, limited stock, or a matching item.

DO NOT use generic phrases like "Don't miss out!" or "Act now!".

RETURN ONLY JSON:
{
  "nudge": "Your warm, natural 1-2 sentence nudge here",
  "nudgeType": "one of: size_help | return_policy | social_proof | stock_alert | style_tip",
  "ctaText": "Short button text like: 'Check Size Guide' or 'View Similar'"
}`;

            const aiResponse = await this.call_deepseek_conversational(prompt);

            await this.log_ai_action(
                userId || 'Guest',
                'customer',
                'Emotion Aware Nudge',
                `Signal: ${signal} | Product: ${productName}`,
                aiResponse
            );

            return responseReturn(res, 200, {
                nudge: aiResponse.nudge,
                nudgeType: aiResponse.nudgeType,
                ctaText: aiResponse.ctaText
            });

        } catch (error) {
            console.error('[NUDGE_ERROR]', error.message);
            return responseReturn(res, 500, { error: 'Nudge generation failed' });
        }
    }

    /* ========================================================
       5. PREDICTIVE RESTOCK ALERT (Cron-Powered, 2030 Supply Chain)
       ======================================================== */

    /**
     * Called by node-cron daily at 9 AM IST.
     * Scans inventory, uses DeepSeek to predict critical restocks,
     * and saves notifications to supplier's WearNotification feed.
     */
    run_predictive_restock_cron = async () => {
        const wearNotificationModel = require('../../models/wear/wearNotificationModel');
        const supplierModel = require('../../models/wear/supplierModel');

        console.log('[CRON] 🤖 Running Predictive Restock AI...');

        try {
            // 1. Find LOW stock products (< 15 units) grouped by supplier
            const lowStockProducts = await wearProductModel.find({ stock: { $lt: 15 }, status: 'active' })
                .select('productName stock category supplierId price brand')
                .lean();

            if (lowStockProducts.length === 0) {
                console.log('[CRON] ✅ All products sufficiently stocked. No alerts needed.');
                return;
            }

            // 2. Group by supplierId
            const bySupplier = {};
            lowStockProducts.forEach(p => {
                const sid = p.supplierId?.toString() || 'unknown';
                if (!bySupplier[sid]) bySupplier[sid] = [];
                bySupplier[sid].push(p);
            });

            // 3. For each supplier, run AI forecast + create notification
            for (const [supplierId, products] of Object.entries(bySupplier)) {
                if (supplierId === 'unknown') continue;

                const productSummary = products.map(p =>
                    `${p.productName} (Stock: ${p.stock}, Category: ${p.category})`
                ).join(' | ');

                const prompt = `TASK: You are a Supply Chain AI for Indian fashion ecommerce Jeenora.
Supplier has these LOW STOCK items: [${productSummary}]
Today's date context: ${new Date().toLocaleDateString('en-IN', { month: 'long', day: 'numeric' })}.

Based on upcoming Indian seasons, festivals, and fashion trends — give a short, actionable restock recommendation.

RETURN ONLY JSON:
{
  "alertTitle": "Short alert title (max 8 words)",
  "alertMessage": "2-3 sentence friendly advisory explaining which products to restock and why (mention season/festival if relevant)",
  "urgencyLevel": "high | medium | low"
}`;

                let aiResponse;
                try {
                    aiResponse = await this.call_deepseek_with_guardrail(prompt);
                } catch (aiErr) {
                    console.error(`[CRON] AI failed for supplier ${supplierId}:`, aiErr.message);
                    continue;
                }

                // 4. Save notification to supplier's notification feed
                try {
                    await wearNotificationModel.create({
                        userId: supplierId,
                        title: aiResponse.alertTitle || '⚠️ Low Stock Alert',
                        message: aiResponse.alertMessage || `You have ${products.length} products running low on stock.`,
                        type: 'system',
                        category: 'Inventory',
                        metadata: {
                            urgencyLevel: aiResponse.urgencyLevel || 'medium',
                            productCount: products.length,
                            products: products.map(p => ({ name: p.productName, stock: p.stock }))
                        }
                    });
                    console.log(`[CRON] ✅ Restock alert saved for supplier: ${supplierId} (${products.length} products)`);
                } catch (saveErr) {
                    console.error(`[CRON] Failed to save notification for ${supplierId}:`, saveErr.message);
                }

                await this.log_ai_action(supplierId, 'supplier', 'Predictive Restock Cron', productSummary, aiResponse);
            }

            console.log(`[CRON] ✅ Predictive Restock scan complete. Processed ${Object.keys(bySupplier).length} suppliers.`);
        } catch (error) {
            console.error('[CRON] ❌ Predictive Restock Cron failed:', error.message);
        }
    }

    /* ========================================================
       6. AUTOMATED AI REPORTING (ADMIN & SUPPLIER)
       ======================================================== */

    /**
     * Generates a Daily Briefing for the Admin.
     * Summarizes yesterday's business health.
     */
    generate_admin_daily_briefing = async () => {
        console.log('[AI_AUTO] 🤖 Generating Admin Daily Briefing...');
        try {
            const yesterday = moment().subtract(1, 'days').startOf('day');
            const today = moment().startOf('day');

            // 1. Fetch Stats
            const orders = await customerOrder.find({
                createdAt: { $gte: yesterday.toDate(), $lt: today.toDate() }
            });

            const totalRevenue = orders.reduce((sum, o) => sum + (o.price || 0), 0);
            const totalOrders = orders.length;
            const paidOrders = orders.filter(o => o.payment_status === 'paid').length;
            
            // Fetch any fraud alerts from previous day (from AILog or metadata)
            const fraudAlerts = await AILog.countDocuments({
                featureName: 'Fraud Assistant Scan',
                createdAt: { $gte: yesterday.toDate(), $lt: today.toDate() }
            });

            const dataSummary = `Stats for ${yesterday.format('DD MMM YYYY')}:
            Revenue: ₹${totalRevenue}
            Orders: ${totalOrders} (${paidOrders} Paid)
            Fraud Alerts Logged: ${fraudAlerts}`;

            const prompt = `TASK: You are the Jeenora Chief AI Officer. 
            Generate a concise "High-Level Executive Briefing" for the Admin based on these stats:
            "${dataSummary}"
            
            Tone: Professional, data-driven, and slightly futuristic. 
            Include: 1 sentence on health, 1 sentence on risk (fraud), and 1 positive takeaway.
            
            RETURN ONLY JSON:
            {
              "subject": "Jeenora Daily Briefing - ${yesterday.format('DD MMM')}",
              "brief": "Your summary here...",
              "whatsappMsg": "Short emoji-rich version for WhatsApp"
            }`;

            const aiResponse = await this.call_deepseek_with_guardrail(prompt);

            // 2. Deliver to Admin
            const adminEmail = process.env.ADMIN_EMAIL || 'admin@jeenora.com';
            const adminPhone = process.env.ADMIN_PHONE; // Should be set in .env

            // Send Email
            await sendEmail(adminEmail, aiResponse.subject, aiResponse.brief);

            // Send WhatsApp if client is ready
            if (adminPhone && whatsappClient.status === 'connected') {
                await whatsappClient.sendMessage(adminPhone, `📊 *${aiResponse.subject}*\n\n${aiResponse.whatsappMsg}`);
            }

            console.log('[AI_AUTO] ✅ Admin Daily Briefing sent.');

        } catch (error) {
            console.error('[AI_AUTO] ❌ Admin Briefing failed:', error.message);
        }
    }

    /**
     * Generates a Weekly Growth Report for a Specific Supplier.
     */
    generate_supplier_weekly_report = async () => {
        console.log('[AI_AUTO] 🤖 Generating Supplier Weekly Reports...');
        try {
            const lastWeek = moment().subtract(7, 'days').startOf('day');

            // Find all active suppliers
            const suppliers = await sellerModel.find({ status: 'active' });

            for (const supplier of suppliers) {
                // 1. Fetch Stats for this supplier
                const orders = await customerOrder.find({
                    'products.sellerId': supplier._id,
                    createdAt: { $gte: lastWeek.toDate() },
                    delivery_status: { $nin: ['cancelled', 'pending_payment'] }
                });

                if (orders.length === 0) continue; // Skip if no sales

                const revenue = orders.reduce((sum, o) => {
                    const sellerProds = o.products.filter(p => p.sellerId.toString() === supplier._id.toString());
                    return sum + sellerProds.reduce((pSum, sp) => pSum + (sp.price * sp.quantity), 0);
                }, 0);

                const dataSummary = `Supplier: ${supplier.name}
                Period: Last 7 days
                Total Sales Revenue: ₹${revenue}
                Total Orders: ${orders.length}
                Top Category: ${orders[0].products[0].category || 'General'}`;

                const prompt = `TASK: You are the Jeenora Supplier Growth AI.
                Analyze these stats for ${supplier.name}:
                "${dataSummary}"
                
                Generate a "Weekly Success Summary". 
                Include: 1 sentence congratulating them, 1 insight about their performance, and 1 growth tip.
                
                RETURN ONLY JSON:
                {
                  "subject": "Your Jeenora Weekly Growth Report 📈",
                  "summary": "Your detailed report here...",
                  "whatsappMsg": "Short emoji-rich version for WhatsApp"
                }`;

                const aiResponse = await this.call_deepseek_with_guardrail(prompt);

                // 2. Deliver to Supplier
                if (supplier.email) {
                    await sendEmail(supplier.email, aiResponse.subject, aiResponse.summary);
                }

                if (supplier.phoneNumber && whatsappClient.status === 'connected') {
                    await whatsappClient.sendMessage(supplier.phoneNumber, `📈 *${aiResponse.subject}*\n\n${aiResponse.whatsappMsg}`);
                }

                console.log(`[AI_AUTO] ✅ Weekly report sent to: ${supplier.name}`);
            }

        } catch (error) {
            console.error('[AI_AUTO] ❌ Supplier Reports failed:', error.message);
        }
    }

    /**
     * Handle incoming WhatsApp messages
     * @param {Object} msg - The message object from whatsapp-web.js
     */
    handleIncomingMessage = async (msg) => {
        try {
            const senderPhone = msg.from.replace('@c.us', '');
            const messageBody = msg.body;

            console.log(`[AI Master] Processing message from ${senderPhone}: ${messageBody}`);

            // Call the core logic directly
            const result = await this.process_customer_support_query(messageBody, [], 'Jeeni');
            
            const reply = result?.replyText || "I'm sorry, I'm having trouble processing that right now.";

            // Send response back via WhatsApp
            await whatsappClient.sendMessage(msg.from, reply);

            // Log the interaction
            await this.log_ai_action(senderPhone, 'whatsapp_user', 'WhatsApp Support', messageBody, result);

        } catch (error) {
            console.error('[AI Master] WhatsApp processing failed:', error.message);
        }
    }
}

module.exports = new AIMasterController();

