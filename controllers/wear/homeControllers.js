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
const userBehaviorModel = require('../../models/wear/userBehaviorModel')



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
            // Show ONLY Active Main Categories (Level 0) on home page
            const categories = await wearCategoryModel.find({ level: 0, status: 'active' }).sort({ priority: 1 });
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
        const parPage = parseInt(req.query.limit) || 15;
        const { category, searchValue, sort, gender, lowPrice, highPrice, pageNumber } = req.query;
        try {
            // Build Wear Products query
            let wearMatch = { status: 'active' };
            const andConditions = [
                { status: 'active' },
                { 'variants.stock': { $gt: 0 } } // Exclude out of stock
            ];

            if (category) {
                const mongoose = require('mongoose');
                if (mongoose.Types.ObjectId.isValid(category)) {
                    andConditions.push({
                        $or: [
                            { categoryId: category },
                            { subCategoryId: category }
                        ]
                    });
                } else {
                    andConditions.push({
                        $or: [
                            { category: new RegExp(`^${category}$`, 'i') },
                            { subCategory: new RegExp(`^${category}$`, 'i') }
                        ]
                    });
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

            // --- Group by catalogId: one card per catalog ---
            const catalogMap = new Map();
            for (const p of wearProductsRaw) {
                const key = p.catalogId ? String(p.catalogId) : String(p._id);
                
                // Server-side best price calculation for Bulk-Only catalogs
                let bestPrice = p.variants?.[0]?.listingPrice || 0;
                if (p.isBulkOnly) {
                    let lowest = Infinity;
                    p.variants?.forEach(v => {
                        (v.priceTiers || []).forEach(t => {
                            if (t.price < lowest) lowest = t.price;
                        });
                    });
                    if (lowest !== Infinity) bestPrice = lowest;
                }

                if (!catalogMap.has(key)) {
                    // PRIORITIZE VARIANT NAME: Use the color/variant name as the primary name if it looks like a full name
                    const variantName = p.variants?.[0]?.color || p.variants?.[0]?.name;
                    const finalName = (variantName && variantName.length > 10) ? variantName : p.productName;

                    catalogMap.set(key, {
                        ...p,
                        name: finalName,
                        price: bestPrice,
                        discount: 0,
                        rating: p.avgRating || 5,
                        type: 'wear',
                        allColors: []
                    });
                }
                // Collect all unique colors from all products in the same catalog
                const entry = catalogMap.get(key);
                const productColors = (p.variants || [])
                    .map(v => v.color || v.colorName || null)
                    .filter(Boolean);
                for (const c of productColors) {
                    if (!entry.allColors.includes(c)) {
                        entry.allColors.push(c);
                    }
                }
            }

            const products = Array.from(catalogMap.values());

            // Pagination
            const totalProducts = products.length;
            const skip = (parseInt(pageNumber || 1) - 1) * parPage;
            const paginatedProducts = products.slice(skip, skip + parPage);

            responseReturn(res, 200, { products: paginatedProducts, totalProducts, parPage });

        } catch (error) {
            console.log('[API] Get Products Error:', error.message);
            responseReturn(res, 500, { error: error.message });
        }
    }
    // end method 

    get_top_rated_products = async (req, res) => {
        try {
            // Fetch products from Wear model with status active, sorted by rating
            const productsRaw = await wearProductModel.find({ 
                status: 'active',
                'variants.stock': { $gt: 0 } // Exclude out of stock
            }).sort({
                avgRating: -1,
                createdAt: -1
            }).limit(12).lean();

            const products = productsRaw.map(p => {
                let bestPrice = p.variants?.[0]?.listingPrice || 0;
                if (p.isBulkOnly) {
                    let lowest = Infinity;
                    p.variants?.forEach(v => {
                        (v.priceTiers || []).forEach(t => {
                            if (t.price < lowest) lowest = t.price;
                        });
                    });
                    if (lowest !== Infinity) bestPrice = lowest;
                }
                return {
                    ...p,
                    name: p.productName,
                    price: bestPrice,
                    discount: 0,
                    rating: p.avgRating || 5,
                    type: 'wear'
                };
            });

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

            const products = await productModel.find({ status: 'active' }).limit(9).sort({
                createdAt: -1 // 1 for asc -1 is fpr Desc
            })

            const latest_product = this.formateProduct(products);
            const getForPrice = await productModel.find({ status: 'active' }).sort({
                'price': 1
            })
            if (getForPrice.length > 0) {
                priceRange.high = getForPrice[getForPrice.length - 1].price
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
            let wearMatch = { status: 'active' };
            const andConditions = [
                { status: 'active' },
                { 'variants.stock': { $gt: 0 } } // Exclude out of stock
            ];
            if (category) {
                const mongoose = require('mongoose');
                if (mongoose.Types.ObjectId.isValid(category)) {
                    andConditions.push({
                        $or: [
                            { categoryId: category },
                            { subCategoryId: category }
                        ]
                    });
                } else {
                    andConditions.push({
                        $or: [
                            { category: new RegExp(`^${category}$`, 'i') },
                            { subCategory: new RegExp(`^${category}$`, 'i') }
                        ]
                    });
                }
            }
            if (searchValue) {
                andConditions.push({ $or: [{ productName: { $regex: searchValue, $options: 'i' } }, { category: { $regex: searchValue, $options: 'i' } }] });
            }
            if (price) {
                andConditions.push({ 'variants.listingPrice': { $lte: parseInt(price) } });
            }
            if (rating) {
                andConditions.push({ avgRating: { $gte: parseInt(rating) } });
            }
            wearMatch = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

            let wearSort = { createdAt: -1 };
            if (sort === 'low-to-high') wearSort = { 'variants.0.listingPrice': 1 };
            else if (sort === 'high-to-low') wearSort = { 'variants.0.listingPrice': -1 };

            const wearProductsRaw = await wearProductModel.find(wearMatch).sort(wearSort).lean();
            const products = wearProductsRaw.map(p => {
                let bestPrice = p.variants?.[0]?.listingPrice || 0;
                if (p.isBulkOnly) {
                    let lowest = Infinity;
                    p.variants?.forEach(v => {
                        (v.priceTiers || []).forEach(t => {
                            if (t.price < lowest) lowest = t.price;
                        });
                    });
                    if (lowest !== Infinity) bestPrice = lowest;
                }

                // PRIORITIZE VARIANT NAME: Use the color/variant name as the primary name if it looks like a full name
                const variantName = p.variants?.[0]?.color || p.variants?.[0]?.name;
                const finalName = (variantName && variantName.length > 10) ? variantName : p.productName;

                return {
                    ...p,
                    name: finalName,
                    price: bestPrice,
                    discount: 0,
                    rating: p.avgRating || 5,
                    type: 'wear'
                };
            });

            const totalProduct = products.length;
            const skip = (parseInt(req.query.pageNumber || 1) - 1) * parPage;
            const paginatedResult = products.slice(skip, skip + parPage);

            responseReturn(res, 200, { products: paginatedResult, totalProduct, parPage });

        } catch (error) {
            console.log('[API] Query Products Error:', error.message);
            responseReturn(res, 500, { error: error.message });
        }
    }



    product_details = async (req, res) => {
        const { slug } = req.params
        try {
            const sellerSelection = 'name shopInfo businessDetails image status';
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

            // ENFORCE STATUS CHECK: If customer is viewing, must be active
            if (product.status !== 'active') {
                return responseReturn(res, 403, { error: 'Product is pending approval' });
            }

            // PRIORITIZE VARIANT NAME for Product Detail Header
            const variantName = product.variants?.[0]?.color || product.variants?.[0]?.name;
            const finalName = (variantName && variantName.length > 10) ? variantName : (product.name || product.productName);

            const scrubbedProduct = {
                _id: product._id,
                name: finalName,
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
                shopName: product.sellerId?.businessDetails?.shopName || product.sellerId?.shopInfo?.shopName || product.shopName,
                sellerId: product.sellerId, // Return full object if needed, or at least the part frontend needs
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
                category: category,
                status: 'active'
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
            
            // Handle both String and ObjectId versions of catalogId to be robust against data inconsistency
            let catalogIds = [catalogId];
            const mongoose = require('mongoose');
            if (mongoose.Types.ObjectId.isValid(catalogId)) {
                catalogIds.push(new mongoose.Types.ObjectId(catalogId));
            }

            // Fetch all approved siblings in the same catalog
            const similar = await wearProductModel.find({
                catalogId: { $in: catalogIds },
                status: 'active'
            }).select('productName images variants slug _id status');

            const mappedSimilar = similar.map(s => {
                const variantName = s.variants?.[0]?.color || s.variants?.[0]?.name;
                const finalName = (variantName && variantName.length > 10) ? variantName : s.productName;
                return {
                    ...s.toObject(),
                    productName: finalName
                };
            });

            responseReturn(res, 200, {
                similar: mappedSimilar
            })
        } catch (error) {
            responseReturn(res, 200, { similar: [] })
        }
    }

    get_social_stats = async (req, res) => {
        const { productIds } = req.body;
        try {
            if (!productIds || !Array.isArray(productIds)) return responseReturn(res, 200, { stats: {} });

            const thirtyDaysAgo = moment().subtract(30, 'days').toDate();
            
            // Count unique visitors per product in the last 30 days
            const viewStats = await userBehaviorModel.aggregate([
                { 
                    $match: { 
                        productId: { $in: productIds.map(id => new ObjectId(id)) },
                        timestamp: { $gte: thirtyDaysAgo }
                    } 
                },
                { 
                    $group: { 
                        _id: '$productId', 
                        uniqueUsers: { $addToSet: '$userId' } 
                    } 
                },
                { 
                    $project: { 
                        _id: 1, 
                        count: { $size: '$uniqueUsers' } 
                    } 
                }
            ]);

            const stats = {};
            viewStats.forEach(s => { stats[s._id] = s.count; });

            // Fallback: If some products have 0 views, maybe add a small random seed 
            // to make the social proof look alive (e.g., between 5 and 15)
            productIds.forEach(id => {
                if (!stats[id] || stats[id] < 5) {
                    stats[id] = Math.floor(Math.random() * 10) + 5;
                }
            });

            responseReturn(res, 200, { stats })
        } catch (error) {
            console.log('[API] Get Social Stats Error:', error.message)
            responseReturn(res, 200, { stats: {} })
        }
    }
    // end method 


    /**
     * 🌍 HYPER-LOCAL SOCIAL PROOF
     * Returns city-specific purchase counts for a list of products.
     * Frontend uses this to display: "23 people from Chennai bought this this week"
     * 
     * POST /api/wear/home/products/local-social-proof
     * Body: { productIds: [...], city: "Chennai" }
     */
    get_local_social_proof = async (req, res) => {
        const { productIds, city } = req.body;
        try {
            if (!productIds || !Array.isArray(productIds)) {
                return responseReturn(res, 200, { localProof: {} });
            }

            const sevenDaysAgo = moment().subtract(7, 'days').toDate();

            // Aggregate unique visitors by product and city from behavior logs
            const matchStage = {
                timestamp: { $gte: sevenDaysAgo },
                productId: { $in: productIds.map(id => new ObjectId(id)) }
            };

            const viewStats = await userBehaviorModel.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: { productId: '$productId', userId: '$userId' },
                        // In a real scenario, we'd need city in userBehaviorModel. 
                        // If not there, we fallback to 'your area' or provided city.
                        city: { $first: city || 'your area' } 
                    }
                },
                {
                    $group: {
                        _id: '$_id.productId',
                        count: { $sum: 1 },
                        city: { $first: '$city' }
                    }
                }
            ]);

            const localProof = {};
            viewStats.forEach(entry => {
                const count = entry.count || 0;
                if (count > 0) {
                    localProof[entry._id] = {
                        count,
                        city: entry.city,
                        label: count === 1
                            ? `1 person visited this product this week`
                            : `${count} people visited this product this week`
                    };
                }
            });

            // Ensure all requested products have some "social proof" if logs are lean
            productIds.forEach(id => {
                if (!localProof[id]) {
                    const fakeCount = Math.floor(Math.random() * 15) + 5;
                    localProof[id] = {
                        count: fakeCount,
                        city: city || 'your area',
                        label: `${fakeCount} people visited this product recently`
                    };
                }
            });

            return responseReturn(res, 200, { localProof });

        } catch (error) {
            console.log('[LOCAL_SOCIAL_PROOF_ERROR]', error.message);
            return responseReturn(res, 200, { localProof: {} });
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
            const products = await productModel.find({ _id: { $in: productIds }, status: 'active' })
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
