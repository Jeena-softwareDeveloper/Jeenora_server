const wearSearchHistoryModel = require('../../models/customer/wearSearchHistoryModel');
const wearProductModel = require('../../models/partner/WearProduct');
const { responseReturn } = require('../../utils/response');
const moment = require('moment');

class searchController {
    
    get_suggestions = async (req, res) => {
        const { q } = req.query;
        try {
            if (!q) return responseReturn(res, 200, { suggestions: [] });
            
            // Search in both productName and category
            const suggestions = await wearProductModel.find({
                $or: [
                    { productName: { $regex: q, $options: 'i' } },
                    { category: { $regex: q, $options: 'i' } }
                ],
                status: 'active'
            }).limit(10).select('productName category images variants _id slug');

            const result = suggestions.map(s => ({
                _id: s._id,
                name: s.productName,
                category: s.category,
                image: s.images?.[0] || '',
                price: s.variants?.[0]?.listingPrice || 0,
                slug: s.slug,
                type: 'product'
            }));
            responseReturn(res, 200, { suggestions: result });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    save_search = async (req, res) => {
        const { q, deviceId, userId } = req.body;
        try {
            if (!q) return responseReturn(res, 400, { error: 'Query required' });

            const filter = { query: q.toLowerCase().trim() };
            if (userId) filter.userId = userId;
            else if (deviceId) filter.deviceId = deviceId;

            await wearSearchHistoryModel.findOneAndUpdate(
                filter,
                { $inc: { count: 1 } },
                { upsert: true, new: true }
            );

            responseReturn(res, 200, { message: 'Search saved' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_history = async (req, res) => {
        const { deviceId, userId } = req.query;
        try {
            const filter = {};
            if (userId) filter.userId = userId;
            else if (deviceId) filter.deviceId = deviceId;
            else return responseReturn(res, 200, { history: [] });

            const history = await wearSearchHistoryModel.find(filter)
                .sort({ updatedAt: -1 })
                .limit(10)
                .select('query');

            responseReturn(res, 200, { history: history.map(h => h.query) });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_trending = async (req, res) => {
        try {
            const sevenDaysAgo = moment().subtract(7, 'days').toDate();
            
            // 1. Trending Queries
            const trendingQueries = await wearSearchHistoryModel.aggregate([
                { $match: { updatedAt: { $gte: sevenDaysAgo } } },
                { $group: { _id: '$query', totalCount: { $sum: '$count' } } },
                { $sort: { totalCount: -1 } },
                { $limit: 10 }
            ]);

            // 2. Trending Products (Featured or Newest)
            const trendingProductsRaw = await wearProductModel.find({ status: 'active' })
                .sort({ isFeatured: -1, createdAt: -1 })
                .limit(5)
                .select('productName images variants _id price');

            const trendingProducts = trendingProductsRaw.map(p => ({
                _id: p._id,
                title: p.productName,
                image: p.images?.[0] || p.image,
                price: p.variants?.[0]?.listingPrice || p.price
            }));

            responseReturn(res, 200, {
                trendingQueries: trendingQueries.map(q => q._id),
                trendingProducts
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new searchController();
