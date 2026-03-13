const bannerModel = require("../../models/wear/bannerModel");
const categoryModel = require("../../models/wear/categoryModel");
const productModel = require("../../models/wear/productModel");
const adminSettingsModel = require("../../models/adminSettingsModel");
const { responseReturn } = require("../../utiles/response");

class homeLayoutController {
    get_home_layout = async (req, res) => {
        try {
            const config = await adminSettingsModel.findOne({ settingKey: 'wearHomeLayout' });
            const activeSections = config?.settingValue || ["Banner", "Categories", "New Arrivals", "Flash Sale", "Recommended"];

            const categories = activeSections.includes("Categories") ? await categoryModel.find({}).limit(14) : [];
            const banners = activeSections.includes("Banner") ? await bannerModel.find({}).limit(5) : [];

            const wearProductModel = require("../../models/wear/wearProductModel");
            let sections = [];

            if (activeSections.includes("New Arrivals")) {
                const products = await wearProductModel.find({ status: 'active' }).sort({ createdAt: -1 }).limit(10).lean();
                sections.push({
                    title: 'New Arrivals',
                    type: 'horizontal_list',
                    products: products.length > 0 ? products : await productModel.find({}).sort({ createdAt: -1 }).limit(10).lean()
                });
            }

            if (activeSections.includes("Flash Sale")) {
                const products = await wearProductModel.find({ status: 'active', discount: { $gt: 0 } }).limit(4).lean();
                sections.push({
                    title: 'Flash Sale',
                    type: 'grid',
                    products: products.length > 0 ? products : await productModel.find({ discount: { $gt: 0 } }).limit(4).lean()
                });
            }

            if (activeSections.includes("Recommended")) {
                const products = await wearProductModel.find({ status: 'active', isFeatured: true }).limit(10).lean();
                sections.push({
                    title: 'Recommended for You',
                    type: 'vertical_list',
                    products: products.length > 0 ? products : await productModel.find({ rating: { $gt: 4 } }).limit(10).lean()
                });
            }

            responseReturn(res, 200, {
                categories,
                banners,
                sections,
                success: true
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_home_categories = async (req, res) => {
        try {
            const categories = await categoryModel.find({}).limit(20);
            responseReturn(res, 200, { categories });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_home_banners = async (req, res) => {
        try {
            const banners = await bannerModel.find({});
            responseReturn(res, 200, { banners });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_home_location = async (req, res) => {
        const { pincode } = req.query;
        try {
            // Mock location data based on pincode if provided
            let locationInfo = {
                pincode: pincode || '638001',
                city: pincode ? 'User City' : 'Erode',
                state: 'Tamil Nadu',
                deliveryStatus: 'Available'
            };
            responseReturn(res, 200, { locationInfo });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_search_suggestions = async (req, res) => {
        const { q } = req.query;
        try {
            if (!q) return responseReturn(res, 200, { suggestions: [] });

            const wearProductModel = require("../../models/wear/wearProductModel");

            // Run queries in parallel for maximum speed
            const [products, wearProducts] = await Promise.all([
                productModel.find({
                    name: { $regex: q, $options: 'i' }
                }).limit(5).select('name images price discount slug').lean(),

                wearProductModel.find({
                    productName: { $regex: q, $options: 'i' },
                    status: 'active'
                }).limit(5).select('productName images variants').lean()
            ]);

            const suggestions = [
                ...products.map(p => ({
                    _id: p._id,
                    name: p.name,
                    image: p.images && p.images.length > 0 ? p.images[0] : '',
                    price: p.price,
                    discount: p.discount,
                    type: 'standard'
                })),
                ...wearProducts.map(p => ({
                    _id: p._id,
                    name: p.productName,
                    image: p.images && p.images.length > 0 ? p.images[0] : '',
                    price: p.variants?.[0]?.listingPrice || 0,
                    type: 'wear'
                }))
            ];

            responseReturn(res, 200, { suggestions });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    save_search_query = async (req, res) => {
        const { q, deviceId } = req.body;
        const userId = req.id;
        try {
            if (!q) return responseReturn(res, 400, { error: 'Query is required' });

            const wearSearchHistoryModel = require("../../models/wear/wearSearchHistoryModel");

            // Delete if already exists for this user/device to move to top (LIFO)
            await wearSearchHistoryModel.deleteOne({
                query: q.trim(),
                $or: [{ userId }, { deviceId }]
            });

            await wearSearchHistoryModel.create({
                userId: userId || null,
                deviceId: deviceId || null,
                query: q.trim()
            });

            responseReturn(res, 201, { success: true });
        } catch (error) {
            console.error('Save Search Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_search_history = async (req, res) => {
        const { deviceId } = req.query;
        const userId = req.id;
        try {
            const wearSearchHistoryModel = require("../../models/wear/wearSearchHistoryModel");
            const history = await wearSearchHistoryModel.find({
                $or: [
                    { userId: userId || 'non_existent_id' },
                    { deviceId: deviceId || 'non_existent_device' }
                ]
            })
                .sort({ createdAt: -1 })
                .limit(10)
                .select('query');

            responseReturn(res, 200, { history: history.map(h => h.query) });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_trending_data = async (req, res) => {
        try {
            const wearSearchHistoryModel = require("../../models/wear/wearSearchHistoryModel");
            const wearProductModel = require("../../models/wear/wearProductModel");
            const customerOrder = require("../../models/wear/customerOrder");

            // 1. Trending Search Queries (Most frequent in last 7 days)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const trendingQueries = await wearSearchHistoryModel.aggregate([
                { $match: { createdAt: { $gte: sevenDaysAgo } } },
                { $group: { _id: "$query", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 8 }
            ]);

            // 2. Trending Products (Best Sellers from Orders)
            // Aggregate from customer orders to find most sold products
            const bestSellingProducts = await customerOrder.aggregate([
                { $unwind: "$products" },
                {
                    $group: {
                        _id: "$products._id",
                        salesCount: { $sum: { $convert: { input: "$products.quantity", to: "int", onError: 1, onNull: 1 } } }
                    }
                },
                { $sort: { salesCount: -1 } },
                { $limit: 5 }
            ]);

            const productIds = bestSellingProducts.map(p => p._id);
            const products = await wearProductModel.find({ _id: { $in: productIds }, status: 'active' })
                .select('productName images variants _id');

            responseReturn(res, 200, {
                trendingQueries: trendingQueries.map(q => q._id),
                trendingProducts: products.map(p => ({
                    _id: p._id,
                    title: p.productName,
                    image: p.images?.[0] || '',
                    price: p.variants?.[0]?.listingPrice || 0
                }))
            });
        } catch (error) {
            console.error('Get Trending Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new homeLayoutController();
