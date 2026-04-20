const category = require('../../models/wear/categoryModel')
const { responseReturn } = require("../../utiles/response")
const productModel = require('../../models/wear/productModel')
const queryProducts = require('../../utiles/queryProducts')
const moment = require('moment')
const reviewModel = require('../../models/reviewModel')
const { mongo: { ObjectId } } = require('mongoose')
const customerModel = require('../../models/wear/customerModel')
const wearProductModel = require('../../models/wear/wearProductModel')
const productOfferModel = require('../../models/wear/productOfferModel')
const customerOrderModel = require('../../models/wear/customerOrder')
const adminSettingsModel = require('../../models/adminSettingsModel')
const wearBuyerModel = require('../../models/wear/wearBuyerModel')



class homeControllers {
    formateProduct = (products) => {
        const productArray = [];
        let i = 0;
        while (i < products.length) {
            let temp = []
            let j = i
            while (j < i + 3) {
                if (products[j]) {
                    temp.push(products[j])
                }
                j++
            }
            productArray.push([...temp])
            i = j
        }
        return productArray
    }



    get_categorys = async (req, res) => {
        try {
            const wearCategoryModel = require('../../models/wear/wearCategoryModel');
            // Show ONLY Main Categories (Level 0) on home page
            const categories = await wearCategoryModel.find({ level: 0 }).sort({ priority: 1 });
            responseReturn(res, 200, {
                categories
            })

        } catch (error) {
            console.log('[API] Get Categories Error:', error.message)
            responseReturn(res, 500, { error: error.message })
        }
    }
    // end method 
    get_products = async (req, res) => {
        const parPage = parseInt(req.query.limit) || 50;
        const { category, searchValue, sort, gender, lowPrice, highPrice, pageNumber } = req.query;
        try {
            let categoryRegexes = [];
            let categoryNames = [];

            if (category) {
                const WearCategory = require('../../models/wear/wearCategoryModel');
                const catDoc = await WearCategory.findOne({ 
                    $or: [{ name: { $regex: new RegExp(`^${category}$`, 'i') } }, { slug: category.toLowerCase() }] 
                });

                if (catDoc) {
                    const childCategories = await WearCategory.find({ parentId: catDoc._id });
                    categoryNames = [catDoc.name, ...childCategories.map(c => c.name)];
                    categoryRegexes = categoryNames.map(n => new RegExp(`^${n}$`, 'i'));
                } else {
                    categoryRegexes = [new RegExp(`^${category}$`, 'i')];
                    categoryNames = [category];
                }
            }

            // Build Wear Products query
            let wearMatch = { status: 'active' };
            const andConditions = [{ status: 'active' }];

            if (category && categoryRegexes.length > 0) {
                andConditions.push({
                    $or: [
                        { category: { $in: categoryRegexes } },
                        { subCategory: { $in: categoryRegexes } }
                    ]
                });
            }

            if (searchValue) {
                andConditions.push({
                    $or: [
                        { productName: { $regex: searchValue, $options: 'i' } },
                        { category: { $regex: searchValue, $options: 'i' } }
                    ]
                });
            }

            // Gender filter
            if (gender) {
                andConditions.push({
                    $or: [
                        { gender: { $regex: new RegExp(`^${gender}$`, 'i') } },
                        { gender: 'unisex' }
                    ]
                });
            }

            // Price filter
            if (lowPrice || highPrice) {
                const priceFilter = {};
                if (lowPrice) priceFilter.$gte = parseInt(lowPrice);
                if (highPrice) priceFilter.$lte = parseInt(highPrice);
                andConditions.push({ 'variants.listingPrice': priceFilter });
            }

            // Size Filter
            if (req.query.size) {
                const sizes = Array.isArray(req.query.size) ? req.query.size : req.query.size.split(',');
                const sizeRegexes = sizes.map(s => new RegExp(`^${s}$`, 'i'));
                andConditions.push({ 'variants.size': { $in: sizeRegexes } });
            }

            // Color Filter
            if (req.query.color) {
                const colors = Array.isArray(req.query.color) ? req.query.color : req.query.color.split(',');
                const colorRegexes = colors.map(c => new RegExp(`^${c}$`, 'i'));
                andConditions.push({ 'variants.color': { $in: colorRegexes } });
            }

            wearMatch = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

            // Sort logic
            let wearSort = { createdAt: -1 }; // default: newest
            if (sort === 'low-to-high') wearSort = { 'variants.0.listingPrice': 1 };
            else if (sort === 'high-to-low') wearSort = { 'variants.0.listingPrice': -1 };
            else if (sort === 'top-rated') wearSort = { avgRating: -1, createdAt: -1 };

            const wearProductsRaw = await wearProductModel.find(wearMatch).sort(wearSort).lean();
            const wearResult = wearProductsRaw.map(p => ({
                ...p,
                name: p.productName,
                price: p.variants?.[0]?.listingPrice || 0,
                discount: 0,
                rating: p.avgRating || 5,
                type: 'wear'
            }));

            // Legacy Products
            let legacyQuery = {};
            if (category && categoryNames.length > 0) legacyQuery.category = { $in: categoryNames };
            if (searchValue) legacyQuery.name = { $regex: searchValue, $options: 'i' };
            if (gender) legacyQuery.gender = { $regex: new RegExp(`^${gender}$`, 'i') };

            let legacySort = { createdAt: -1 };
            if (sort === 'low-to-high') legacySort = { price: 1 };
            else if (sort === 'high-to-low') legacySort = { price: -1 };
            else if (sort === 'top-rated') legacySort = { rating: -1 };

            const legacyResult = await productModel.find(legacyQuery).sort(legacySort).lean();

            // Combine & De-duplicate
            const combinedMap = new Map();
            [...legacyResult, ...wearResult].forEach(p => {
                const key = p.slug || p._id.toString();
                if (!combinedMap.has(key)) combinedMap.set(key, p);
            });
            const allCombined = Array.from(combinedMap.values());

            // Pagination
            const totalProducts = allCombined.length;
            const skip = (parseInt(pageNumber || 1) - 1) * parPage;
            const products = allCombined.slice(skip, skip + parPage);

            responseReturn(res, 200, { products, totalProducts, parPage });

        } catch (error) {
            console.log('[API] Get Products Error:', error.message);
            responseReturn(res, 500, { error: error.message });
        }
    }
    // end method 

    get_top_rated_products = async (req, res) => {
        try {
            // Fetch products with rating >= 4, sorted by rating desc, limit to 12
            const products = await productModel.find({ 
                rating: { $gte: 4 },
                status: 'active'
            }).sort({
                rating: -1,
                createdAt: -1
            }).limit(4);

            responseReturn(res, 200, {
                products
            });
        } catch (error) {
            console.log('[API] Get Top Rated Error:', error.message);
            responseReturn(res, 500, { error: error.message });
        }
    }
    // end method

    price_range_product = async (req, res) => {
        try {
            const priceRange = {
                low: 0,
                high: 0,
            }

            const products = await productModel.find({}).limit(9).sort({
                createdAt: -1 // 1 for asc -1 is fpr Desc
            })

            const latest_product = this.formateProduct(products);
            const getForPrice = await productModel.find({}).sort({
                'price': 1
            })
            if (getForPrice.length > 0) {
                priceRange.high = getForPrice
                [getForPrice.length - 1].price
                priceRange.low = getForPrice[0].price
            }
            responseReturn(res, 200, {
                latest_product,
                priceRange
            })
        } catch (error) {
            console.log(error.message)
        }
    }
    // end method 

    query_products = async (req, res) => {
        const parPage = 12;
        const { category, searchValue, price, rating, sort } = req.query;
        try {
            let categoryRegexes = [];
            let categoryNames = [];

            if (category) {
                const WearCategory = require('../../models/wear/wearCategoryModel');
                const catDoc = await WearCategory.findOne({ 
                    $or: [{ name: { $regex: new RegExp(`^${category}$`, 'i') } }, { slug: category.toLowerCase() }] 
                });

                if (catDoc) {
                    const childCategories = await WearCategory.find({ parentId: catDoc._id });
                    categoryNames = [catDoc.name, ...childCategories.map(c => c.name)];
                    categoryRegexes = categoryNames.map(n => new RegExp(`^${n}$`, 'i'));
                } else {
                    categoryRegexes = [new RegExp(`^${category}$`, 'i')];
                    categoryNames = [category];
                }
            }

            // 1. Search Legacy Products
            const legacyProducts = await productModel.find({}).sort({ createdAt: -1 }).lean();
            
            // Custom filtering for legacy since categoryQuery in utility is basic
            let filteredLegacy = legacyProducts;
            if (category && categoryNames.length > 0) {
                filteredLegacy = legacyProducts.filter(p => 
                    categoryNames.some(cn => p.category && p.category.toLowerCase() === cn.toLowerCase())
                );
            }

            const legacyResult = new queryProducts(filteredLegacy, req.query)
                .ratingQuery()
                .searchQuery()
                .priceQuery()
                .sizeQuery()
                .colorQuery()
                .genderQuery()
                .sortByPrice()
                .getProducts();

            // 2. Search Wear Products (New Catalog Style)
            let wearMatch = { status: 'active' };
            const andConditions = [{ status: 'active' }];

            if (category) {
                if (categoryRegexes.length > 0) {
                    andConditions.push({
                        $or: [
                            { category: { $in: categoryRegexes } },
                            { subCategory: { $in: categoryRegexes } }
                        ]
                    });
                } else {
                    andConditions.push({ category: { $regex: new RegExp(`^${category}$`, 'i') } });
                }
            }

            if (searchValue) {
                andConditions.push({
                    $or: [
                        { productName: { $regex: searchValue, $options: 'i' } },
                        { category: { $regex: searchValue, $options: 'i' } }
                    ]
                });
            }

            if (req.query.size) {
                const sizes = Array.isArray(req.query.size) ? req.query.size : req.query.size.split(',');
                const sizeRegexes = sizes.map(s => new RegExp(`^${s}$`, 'i'));
                andConditions.push({ 'variants.size': { $in: sizeRegexes } });
            }

            if (req.query.color) {
                const colors = Array.isArray(req.query.color) ? req.query.color : req.query.color.split(',');
                const colorRegexes = colors.map(c => new RegExp(`^${c}$`, 'i'));
                andConditions.push({ 'variants.color': { $in: colorRegexes } });
            }

            wearMatch = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

            const wearProductsRaw = await wearProductModel.find(wearMatch).sort({ createdAt: -1 }).lean();
            const wearResult = wearProductsRaw.map(p => ({
                ...p,
                name: p.productName, // compatibility
                price: p.variants?.[0]?.listingPrice || 0, // compatibility
                discount: 0,
                rating: 5,
                type: 'wear'
            }));

            // Combine and De-duplicate by slug or name
            const combinedMap = new Map();
            [...legacyResult, ...wearResult].forEach(p => {
                const key = p.slug || p._id.toString();
                if (!combinedMap.has(key)) {
                    combinedMap.set(key, p);
                }
            });
            const allCombined = Array.from(combinedMap.values());

            // Manual pagination for combined results
            const totalProduct = allCombined.length;
            const skip = (parseInt(req.query.pageNumber || 1) - 1) * parPage;
            const paginatedResult = allCombined.slice(skip, skip + parPage);

            responseReturn(res, 200, {
                products: paginatedResult,
                totalProduct,
                parPage
            });

        } catch (error) {
            console.log('[API] Query Products Error:', error.message);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // END METHOD
    get_top_rated_products = async (req, res) => {
        try {
            // Find top rated products from legacy
            const legacyTopRated = await productModel.find({}).sort({ rating: -1 }).limit(10).lean();

            // Find top rated products from Wear
            const wearTopRatedRaw = await wearProductModel.find({ status: 'active' }).limit(10).lean();
            const wearTopRated = wearTopRatedRaw.map(p => ({
                ...p,
                name: p.productName,
                price: p.variants?.[0]?.listingPrice || 0,
                discount: 0,
                rating: 5, // default for wear
                type: 'wear'
            }));

            const combined = [...legacyTopRated, ...wearTopRated].sort((a, b) => b.rating - a.rating).slice(0, 10);

            responseReturn(res, 200, {
                products: combined
            });
        } catch (error) {
            console.log('[API] Get Top Rated Error:', error.message);
            responseReturn(res, 500, { error: error.message });
        }
    }

    product_details = async (req, res) => {
        const { slug } = req.params
        try {
            const sellerSelection = 'name shopInfo image status';
            let product = await productModel.findOne({ slug }).populate({ path: 'offers', match: { status: 'active' } }).populate('sellerId', sellerSelection);

            if (!product && ObjectId.isValid(slug)) {
                product = await productModel.findById(slug).populate({ path: 'offers', match: { status: 'active' } }).populate('sellerId', sellerSelection);
            }

            // check the new WearProduct model (Meesho-style)
            let isWearProduct = false;
            if (!product) {
                product = await wearProductModel.findOne({ slug })
                    .populate({ path: 'offers', match: { status: 'active' } })
                    .populate('sellerId', sellerSelection);
                if (!product && ObjectId.isValid(slug)) {
                    product = await wearProductModel.findById(slug)
                        .populate({ path: 'offers', match: { status: 'active' } })
                        .populate('sellerId', sellerSelection);
                }
                if (product) isWearProduct = true;
            }

            if (!product) {
                return responseReturn(res, 404, { error: 'Product Not Found' });
            }

            const scrubbedProduct = {
                _id: product._id,
                name: product.name || product.productName,
                slug: product.slug,
                images: product.images,
                category: product.category,
                subCategory: product.subCategory,
                price: product.price || product.variants?.[0]?.listingPrice,
                originalPrice: product.originalPrice || product.variants?.[0]?.mrp,
                discount: product.discount || 0,
                rating: product.rating || 5,
                description: product.description,
                brand: product.brand,
                shopName: product.sellerId?.shopInfo?.shopName || product.shopName,
                sellerId: product.sellerId?._id,
                variants: product.variants || [],
                offers: product.offers || [],
                catalogId: product.catalogId,
                type: isWearProduct ? 'wear' : 'legacy'
            };

            responseReturn(res, 200, {
                product: scrubbedProduct
            })

        } catch (error) {
            console.log('[HOME_CONTROLLER_ERROR]', error.message)
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    get_related_products = async (req, res) => {
        const { category, productId } = req.query;
        try {
            const related = await wearProductModel.find({
                _id: { $ne: productId },
                category: category,
                status: 'active'
            }).limit(12).select('productName images variants slug category _id');

            const legacyRelated = await productModel.find({
                _id: { $ne: productId },
                category: category
            }).limit(12).select('name images price discount slug _id');

            responseReturn(res, 200, {
                related: [...related, ...legacyRelated].slice(0, 12)
            })
        } catch (error) {
            responseReturn(res, 200, { related: [] })
        }
    }

    get_similar_products = async (req, res) => {
        const { catalogId, productId } = req.query;
        try {
            if (!catalogId) return responseReturn(res, 200, { similar: [] });
            
            const similar = await wearProductModel.find({
                catalogId,
                status: 'active'
            }).select('productName images variants slug _id');

            responseReturn(res, 200, {
                similar
            })
        } catch (error) {
            responseReturn(res, 200, { similar: [] })
        }
    }

    get_social_stats = async (req, res) => {
        const { productIds } = req.body; // Array of IDs
        try {
            if (!productIds || !Array.isArray(productIds)) return responseReturn(res, 200, { stats: {} });

            const thirtyDaysAgo = moment().subtract(30, 'days').toDate();
            const orderCounts = await customerOrderModel.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo }, delivery_status: { $ne: 'cancelled' } } },
                { $unwind: '$products' },
                { $match: { 'products._id': { $in: productIds } } },
                { $group: { _id: '$products._id', count: { $sum: 1 } } }
            ]);

            const stats = {};
            orderCounts.forEach(c => { stats[c._id] = c.count; });

            responseReturn(res, 200, { stats })
        } catch (error) {
            responseReturn(res, 200, { stats: {} })
        }
    }
    // end method 


    submit_review = async (req, res) => {
        const { productId, rating, review, name } = req.body
        try {
            await reviewModel.create({
                productId,
                name,
                rating,
                review,
                date: moment(Date.now()).format('LL')
            })
            let rat = 0;
            const reviews = await reviewModel.find({
                productId
            })
            for (let i = 0; i < reviews.length; i++) {
                rat = rat + reviews[i].rating
            }
            let productRating = 0
            if (reviews.length !== 0) {
                productRating = (rat / reviews.length).toFixed(1)
            }
            await productModel.findByIdAndUpdate(productId, {
                rating: productRating
            })
            responseReturn(res, 201, {
                message: "Review Added Successfully"
            })

        } catch (error) {
            console.log(error.message)
        }
    }
    // end method 

    get_reviews = async (req, res) => {
        const { productId } = req.params
        let { pageNo } = req.query
        pageNo = parseInt(pageNo)
        const limit = 5
        const skipPage = limit * (pageNo - 1)
        try {
            let getRating = await reviewModel.aggregate([{
                $match: {
                    productId: {
                        $eq: new ObjectId(productId)
                    },
                    rating: {
                        $not: {
                            $size: 0
                        }
                    }
                }
            },
            {
                $unwind: "$rating"
            },
            {
                $group: {
                    _id: "$rating",
                    count: {
                        $sum: 1
                    }
                }
            }
            ])
            let rating_review = [{
                rating: 5,
                sum: 0
            },
            {
                rating: 4,
                sum: 0
            },
            {
                rating: 3,
                sum: 0
            },
            {
                rating: 2,
                sum: 0
            },
            {
                rating: 1,
                sum: 0
            }
            ]
            for (let i = 0; i < rating_review.length; i++) {
                for (let j = 0; j < getRating.length; j++) {
                    if (rating_review[i].rating === getRating[j]._id) {
                        rating_review[i].sum = getRating[j].count
                        break
                    }
                }
            }
            const getAll = await reviewModel.find({
                productId
            })
            const reviews = await reviewModel.find({
                productId
            }).skip(skipPage).limit(limit).sort({ createdAt: -1 })
            responseReturn(res, 200, {
                reviews,
                totalReview: getAll.length,
                rating_review
            })

        } catch (error) {
            console.log(error.message)
        }
    }
    // end method

    validate_recent_products = async (req, res) => {
        const { productIds } = req.body;
        try {
            if (!productIds || !Array.isArray(productIds)) {
                return responseReturn(res, 400, { error: 'Invalid productIds' });
            }
            const products = await productModel.find({ _id: { $in: productIds } })
                .select('name price listingPrice originalPrice mrp images slug category subCategory _id variants shopName seller rating discount');
            responseReturn(res, 200, { products });
        } catch (error) {
            console.log(error.message);
            responseReturn(res, 200, { products: [] });
        }
    }
    // end method

    add_to_recent = async (req, res) => {
        const { productId, userId } = req.body;
        try {
            if (!userId) return responseReturn(res, 400, { error: 'User ID required' });

            // Try WearBuyer first, then Customer
            let user = await wearBuyerModel.findById(userId);
            if (!user) user = await customerModel.findById(userId);
            
            if (!user) return responseReturn(res, 404, { error: 'User not found' });

            // Remove if exists to re-add at top (Limit 20)
            let recent = user.recentViewed || [];
            recent = recent.filter(p => p.toString() !== productId);
            recent.unshift(productId); // Add to beginning
            if (recent.length > 20) recent.pop();

            user.recentViewed = recent;
            await user.save();
            responseReturn(res, 200, { message: 'Added to recent' });
        } catch (error) {
            console.log(error.message);
            responseReturn(res, 500, { error: error.message });
        }
    }
    // end method

    get_recent_products = async (req, res) => {
        const { userId } = req.params;
        try {
            // Try WearBuyer first
            let user = await wearBuyerModel.findById(userId).populate({
                path: 'recentViewed',
                select: 'name productName price listingPrice originalPrice mrp images slug category subCategory _id variants shopName seller rating discount'
            });

            // If not found in WearBuyer, try Customer
            if (!user) {
                user = await customerModel.findById(userId).populate({
                    path: 'recentViewed',
                    select: 'name productName price listingPrice originalPrice mrp images slug category subCategory _id variants shopName seller rating discount'
                });
            }

            if (!user) return responseReturn(res, 404, { error: 'User not found' });

            responseReturn(res, 200, { products: user.recentViewed });
        } catch (error) {
            console.log(error.message);
            responseReturn(res, 500, { error: error.message });
        }
    }
    // end method


}

module.exports = new homeControllers()
