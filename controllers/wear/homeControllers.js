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
            const categorys = await category.find({})
            responseReturn(res, 200, {
                categorys
            })

        } catch (error) {
            console.log(error)
        }
    }
    // end method 
    get_products = async (req, res) => {
        try {
            const products = await productModel.find({}).limit(12).sort({
                createdAt: -1
            })
            const allProduct1 = await productModel.find({}).limit(9).sort({
                createdAt: -1
            })
            const latest_product = this.formateProduct(allProduct1);

            const allProduct2 = await productModel.find({}).limit(9).sort({
                rating: -1
            })
            const topRated_product = this.formateProduct(allProduct2);

            const allProduct3 = await productModel.find({}).limit(9).sort({
                discount: -1
            })
            const discount_product = this.formateProduct(allProduct3);
            responseReturn(res, 200, {
                products,
                latest_product,
                topRated_product,
                discount_product
            })

        } catch (error) {
            console.log(error.message)
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
            // 1. Search Legacy Products
            const legacyProducts = await productModel.find({}).sort({ createdAt: -1 }).lean();
            const legacyResult = new queryProducts(legacyProducts, req.query).categoryQuery().ratingQuery().searchQuery().priceQuery().sortByPrice().getProducts();

            // 2. Search Wear Products (New Catalog Style)
            let wearMatch = { status: 'active' };
            if (category) wearMatch.category = category;
            if (searchValue) {
                wearMatch.$or = [
                    { productName: { $regex: searchValue, $options: 'i' } },
                    { category: { $regex: searchValue, $options: 'i' } }
                ];
            }

            const wearProductsRaw = await wearProductModel.find(wearMatch).sort({ createdAt: -1 }).lean();
            const wearResult = wearProductsRaw.map(p => ({
                ...p,
                name: p.productName, // compatibility
                price: p.variants?.[0]?.listingPrice || 0, // compatibility
                discount: 0,
                rating: 5,
                type: 'wear'
            }));

            // Combine
            const allCombined = [...legacyResult, ...wearResult];

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

    product_details = async (req, res) => {
        const { slug } = req.params
        try {
            let product = await productModel.findOne({ slug }).populate({ path: 'offers', match: { status: 'active' } }).populate('sellerId')

            if (!product && ObjectId.isValid(slug)) {
                product = await productModel.findById(slug).populate({ path: 'offers', match: { status: 'active' } }).populate('sellerId')
            }

            // If still not found, check the new WearProduct model (Meesho-style)
            let isWearProduct = false;
            if (!product) {
                product = await wearProductModel.findOne({ slug }).populate({ path: 'offers', match: { status: 'active' } }).populate('sellerId');
                if (!product && ObjectId.isValid(slug)) {
                    product = await wearProductModel.findById(slug).populate({ path: 'offers', match: { status: 'active' } }).populate('sellerId');
                }
                if (product) isWearProduct = true;
            }

            if (!product) {
                return responseReturn(res, 404, { error: 'Product Not Found' });
            }

            const activeModel = isWearProduct ? wearProductModel : productModel;

            const relatedProducts = await activeModel.find({
                _id: { $ne: product._id },
                category: product.category
            }).limit(12)

            const moreProducts = await activeModel.find({
                _id: { $ne: product._id },
                sellerId: product.sellerId
            }).limit(3)

            let similarProducts = [];
            if (product.catalogId) {
                similarProducts = await activeModel.find({
                    catalogId: product.catalogId
                });
            }

            const thirtyDaysAgo = moment().subtract(30, 'days').toDate();
            const allProductIds = [product._id.toString(), ...similarProducts.map(p => p._id.toString())];

            const orderCounts = await customerOrderModel.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo }, delivery_status: { $ne: 'cancelled' } } },
                { $unwind: '$products' },
                { $match: { 'products._id': { $in: allProductIds } } },
                { $group: { _id: '$products._id', count: { $sum: 1 } } }
            ]);

            const countMap = {};
            
            // Fetch Config for Social Proof
            const wearSetting = await adminSettingsModel.findOne({ settingKey: 'wear_config' });
            const wearConfig = wearSetting ? wearSetting.settingValue : {};
            const isSocialEnabled = wearConfig.social_proof_enabled !== false; // default true
            const minThreshold = wearConfig.social_proof_min_threshold || 0;

            orderCounts.forEach(c => { 
                if (isSocialEnabled && c.count >= minThreshold) {
                    countMap[c._id] = c.count; 
                } else {
                    countMap[c._id] = 0;
                }
            });

            const enrichedSimilarProducts = similarProducts.map(p => ({
                ...p.toObject(),
                monthOrderCount: countMap[p._id.toString()] || 0
            }));

            responseReturn(res, 200, {
                product: {
                    ...product.toObject(),
                    similarProducts: enrichedSimilarProducts,
                    monthOrderCount: countMap[product._id.toString()] || 0
                },
                relatedProducts,
                moreProducts,
                similarProducts: enrichedSimilarProducts
            })

        } catch (error) {
            console.log('[HOME_CONTROLLER_ERROR]', error.message)
            responseReturn(res, 500, { error: 'Internal Server Error' })
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

            const user = await customerModel.findById(userId);
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
            const user = await customerModel.findById(userId).populate({
                path: 'recentViewed',
                select: 'name price listingPrice originalPrice mrp images slug category subCategory _id variants shopName seller rating discount'
            });

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