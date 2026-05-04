const WearProduct = require('../../models/wear/wearProductModel');
const Supplier = require('../../models/wear/supplierModel');
const Seller = require('../../models/wear/sellerModel');
const { responseReturn } = require('../../utiles/response');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const cloudinary = require('../../utiles/cloudinary');

class wearCatalogController {
    // Helper to upload images to Cloudinary with optional background removal
    uploadImage = async (base64Data, removeBackground = false) => {
        try {
            // 1. If it's already a URL, return it as is
            if (base64Data.startsWith('http')) return base64Data;

            // 2. Prepare Cloudinary options
            const options = {
                folder: 'wear_products',
                resource_type: 'image',
                format: removeBackground ? 'png' : undefined
            };

            if (removeBackground) {
                options.background_removal = "cloudinary_ai";
            }

            // 3. Attempt upload
            const result = await cloudinary.uploader.upload(base64Data, options);
            if (!result || !result.secure_url) {
                throw new Error("Cloudinary did not return a secure URL");
            }
            return result.secure_url;
        } catch (error) {
            console.error('❌ Cloudinary Error:', error.message);
            // hard error: avoid saving base64 to DB
            throw new Error(`Cloudinary Upload Failed: ${error.message}. Check your Cloud Name and API Keys.`);
        }
    }


    // Helper to generate unique SKU
    generateSKU = (shopName) => {
        const vendorShort = shopName ? shopName.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '') : 'VND';
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `JEEN-${vendorShort}-${randomStr}`;
    }

    // Add new product catalog (Meesho flow) - Supports bulk similar products
    add_catalog = async (req, res) => {
        const { id } = req;
        const body = req.body;

        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier account not found.' });
            }

            // Check if input is an array (multi-product catalog) or single product
            const productsToCreate = Array.isArray(body) ? body : [body];
            const createdProducts = [];

            // --- KEY FIX: Generate ONE shared catalogId for this entire upload batch ---
            // If the frontend already sent a sharedCatalogId (e.g. for a re-upload), use it.
            // Otherwise generate a fresh one so all products in this batch group together.
            const sharedCatalogId = (productsToCreate[0]?.catalogId && productsToCreate.every(p => p.catalogId === productsToCreate[0].catalogId))
                ? productsToCreate[0].catalogId
                : new mongoose.Types.ObjectId().toString();

            for (const item of productsToCreate) {
                // --- IMAGE PROCESSING ---
                // Support automatic background removal if requested
                const processedImages = [];
                if (item.images && Array.isArray(item.images)) {
                    for (const img of item.images) {
                        if (img.startsWith('data:image')) {
                            const url = await this.uploadImage(img, item.removeBackground);
                            if (url) processedImages.push(url);
                        } else {
                            processedImages.push(img);
                        }
                    }
                }

                // --- VALIDATION RULES ---
                if (!item.variants || item.variants.length === 0) {
                    return responseReturn(res, 400, { error: `Product "${item.productName}" must have at least one variant.` });
                }

                const seenCombos = new Set();
                for (const v of item.variants) {
                    // 1. Same size+color duplicate check
                    const combo = `${(v.size || '').trim().toLowerCase()}-${(v.color || '').trim().toLowerCase()}`;
                    if (seenCombos.has(combo)) {
                        return responseReturn(res, 400, { error: `Duplicate variant detected for "${item.productName}": Size ${v.size}, Color ${v.color}` });
                    }
                    seenCombos.add(combo);

                    // 2. Stock negative check
                    if (v.stock < 0) {
                        return responseReturn(res, 400, { error: `Stock cannot be negative for variant ${v.size}/${v.color} in product "${item.productName}".` });
                    }
                }

                let product;
                if (item._id && mongoose.Types.ObjectId.isValid(item._id)) {
                    // 1. Update Existing Product
                    product = await WearProduct.findByIdAndUpdate(item._id, {
                        sellerId: supplier._id,
                        catalogId: sharedCatalogId,
                        productName: item.productName,
                        description: item.description,
                        miniDescription: item.miniDescription,
                        detailedDescription: item.detailedDescription,
                        isPrimary: item.isPrimary,
                        category: item.category,
                        subCategory: item.subCategory,
                        images: processedImages,
                        hsnCode: item.hsnCode,
                        gstPercentage: item.gstPercentage,
                        weight: item.weight,
                        dimensions: item.dimensions,
                        attributes: item.attributes,
                        alterSlug: item.alterSlug,
                        tags: item.tags && typeof item.tags === 'string' ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : (Array.isArray(item.tags) ? item.tags : []),
                        variants: (item.variants || []).map(v => ({
                            ...v,
                            skuId: v.skuId || this.generateSKU(supplier.businessDetails?.shopName)
                        })),
                        minOrderQty: item.minOrderQty || 1,
                        status: item.status || 'pending'
                    }, { new: true });
                } else {
                    // 2. Create New Product Variation
                    product = await WearProduct.create({
                        sellerId: supplier._id,
                        catalogId: sharedCatalogId,
                        productName: item.productName,
                        description: item.description,
                        miniDescription: item.miniDescription,
                        detailedDescription: item.detailedDescription,
                        isPrimary: item.isPrimary,
                        category: item.category,
                        subCategory: item.subCategory,
                        images: processedImages,
                        hsnCode: item.hsnCode,
                        gstPercentage: item.gstPercentage,
                        weight: item.weight,
                        dimensions: item.dimensions,
                        attributes: item.attributes,
                        alterSlug: item.alterSlug,
                        tags: item.tags && typeof item.tags === 'string' ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : (Array.isArray(item.tags) ? item.tags : []),
                        variants: (item.variants || []).map(v => ({
                            ...v,
                            skuId: v.skuId || this.generateSKU(supplier.businessDetails?.shopName)
                        })),
                        minOrderQty: item.minOrderQty || 1,
                        status: 'pending'
                    });
                }
                if (product) createdProducts.push(product);
            }

            responseReturn(res, 201, {
                success: true,
                message: `${createdProducts.length} product(s) uploaded successfully to catalog ${sharedCatalogId}.`,
                data: createdProducts
            });
        } catch (error) {
            console.error('Add Catalog Error:', error);
            if (error.code === 11000) {
                return responseReturn(res, 400, { error: 'Duplicate SKU detected. Each variant must have a unique SKU across the platform.' });
            }
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Get supplier's own catalogs - Grouped by catalogId
    get_my_catalogs = async (req, res) => {
        const { id } = req;
        try {
            console.log(`[Inventory] Fetching catalogs for User ID: ${id}`);
            const supplier = await Supplier.findOne({ user: id });

            if (!supplier) {
                console.log(`[Inventory] Supplier NOT found for User ID: ${id}`);
                return responseReturn(res, 200, { success: true, catalogs: [] });
            }

            const sellerObjectId = new mongoose.Types.ObjectId(String(supplier._id));
            const productModel = require('../../models/wear/productModel');

            // 1. Get Grouped Wear Catalogs (aggregated by catalogId)
            const groupedCatalogs = await WearProduct.aggregate([
                { $match: { sellerId: sellerObjectId } },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: { 
                            $cond: { 
                                if: { $or: [{ $eq: ["$catalogId", null] }, { $eq: ["$catalogId", ""] }, { $not: ["$catalogId"] }] }, 
                                then: "$_id", 
                                else: { $toString: "$catalogId" } 
                            } 
                        },
                        mainProduct: { $first: "$$ROOT" },
                        allProducts: { $push: "$$ROOT" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "mainProduct.createdAt": -1 } }
            ]);

            const wearCatalogs = groupedCatalogs.map(g => ({
                ...g.mainProduct,
                _id: g.mainProduct._id,
                catalogId: g.mainProduct.catalogId || g._id,
                similarProductsCount: g.count,
                similarProducts: g.allProducts
            }));

            // 2. Get Legacy Products for this seller
            const legacyProductsRaw = await productModel.find({ sellerId: sellerObjectId }).sort({ createdAt: -1 }).lean();

            const legacyCatalogs = legacyProductsRaw.map(p => ({
                ...p,
                productName: p.name,
                catalogId: p._id,
                variants: p.variants || [{
                    listingPrice: p.price,
                    mrp: p.price + (p.discount || 0),
                    size: 'Standard',
                    color: 'Multi',
                    stock: p.stock
                }],
                similarProductsCount: 1,
                similarProducts: [p],
                isLegacy: true,
                status: p.status || 'active'
            }));

            // 3. Combine and Sort
            const allCatalogs = [...wearCatalogs, ...legacyCatalogs].sort((a, b) =>
                new Date(b.createdAt) - new Date(a.createdAt)
            );

            console.log(`[Inventory] Returning ${allCatalogs.length} catalogs total (${wearCatalogs.length} wear, ${legacyCatalogs.length} legacy)`);

            responseReturn(res, 200, { success: true, catalogs: allCatalogs });
        } catch (error) {
            console.error('[Inventory] Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Update catalog details
    update_catalog = async (req, res) => {
        const { productId } = req.params;
        const updateData = req.body;

        try {
            // Find the product first to get its catalogId
            const productToUpdate = await WearProduct.findById(productId);
            if (!productToUpdate) return responseReturn(res, 404, { error: 'Product not found' });

            // If we are updating status, update all products in the same catalog group
            if (updateData.status && productToUpdate.catalogId) {
                console.log(`[Admin] Updating status to ${updateData.status} for catalog: ${productToUpdate.catalogId}`);
                await WearProduct.updateMany(
                    { catalogId: productToUpdate.catalogId },
                    { $set: { status: updateData.status } }
                );
            }

            // Also update the specific product with all details
            const updatedProduct = await WearProduct.findByIdAndUpdate(productId, updateData, { new: true });

            responseReturn(res, 200, { success: true, message: 'Catalog group updated successfully', data: updatedProduct });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Admin: Get all catalogs from all suppliers - Grouped by catalogId
    get_all_catalogs = async (req, res) => {
        try {
            const productModel = require('../../models/wear/productModel');

            // 1. Get Grouped Wear Catalogs (Meesho Flow)
            const groupedCatalogs = await WearProduct.aggregate([
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: { 
                            $cond: { 
                                if: { $or: [{ $eq: ["$catalogId", null] }, { $eq: ["$catalogId", ""] }, { $not: ["$catalogId"] }] }, 
                                then: "$_id", 
                                else: { $toString: "$catalogId" }
                            } 
                        },
                        mainProduct: { $first: "$$ROOT" },
                        allProducts: { $push: "$$ROOT" },
                        count: { $sum: 1 },
                        sellerId: { $first: "$sellerId" }
                    }
                },
                {
                    $lookup: {
                        from: "suppliers",
                        localField: "sellerId",
                        foreignField: "_id",
                        as: "supplierInfo"
                    }
                },
                {
                    $lookup: {
                        from: "sellers",
                        localField: "sellerId",
                        foreignField: "_id",
                        as: "sellerInfo"
                    }
                },
                { $sort: { "mainProduct.createdAt": -1 } }
            ]);

            const wearCatalogs = groupedCatalogs.map(g => {
                const sellerInfo = (g.supplierInfo && g.supplierInfo.length > 0)
                    ? g.supplierInfo[0]
                    : (g.sellerInfo && g.sellerInfo.length > 0 ? g.sellerInfo[0] : { _id: g.sellerId, businessDetails: { shopName: 'Unknown Seller' } });

                return {
                    ...g.mainProduct,
                    _id: g.mainProduct._id,
                    catalogId: g._id,
                    sellerId: sellerInfo,
                    similarProductsCount: g.count,
                    similarProducts: g.allProducts
                };
            });

            // 2. Get Legacy Products and convert to Catalog Structure for UI
            const legacyProductsRaw = await productModel.find({}).sort({ createdAt: -1 }).lean();
            const [suppliers, sellers] = await Promise.all([
                Supplier.find({}).lean(),
                Seller.find({}).lean()
            ]);

            const supplierMap = new Map();
            suppliers.forEach(s => supplierMap.set(s._id.toString(), s));
            sellers.forEach(s => {
                if (!supplierMap.has(s._id.toString())) {
                    supplierMap.set(s._id.toString(), {
                        ...s,
                        businessDetails: { shopName: s.shopInfo?.shopName || s.name },
                        status: s.status
                    });
                }
            });

            const legacyCatalogs = legacyProductsRaw.map(p => ({
                ...p,
                productName: p.name,
                sellerId: supplierMap.get(p.sellerId?.toString()) || { _id: p.sellerId, businessDetails: { shopName: p.shopName || 'Legacy Seller' } },
                catalogId: p._id,
                variants: p.variants || [{
                    listingPrice: p.price,
                    mrp: p.price + (p.discount || 0),
                    size: 'Standard',
                    color: 'Multi',
                    stock: p.stock
                }],
                similarProductsCount: 1,
                similarProducts: [p],
                isLegacy: true,
                status: p.status || 'active'
            }));

            // Combine and sort by date
            const allCatalogs = [...wearCatalogs, ...legacyCatalogs].sort((a, b) =>
                new Date(b.createdAt) - new Date(a.createdAt)
            );

            responseReturn(res, 200, { success: true, products: allCatalogs });
        } catch (error) {
            console.error('[Catalog] Fetch All Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Admin: Get grouped catalogs for a specific supplier
    get_manual_list = async (req, res) => {
        const { sellerId } = req.query;
        try {
            if (!sellerId) return responseReturn(res, 400, { error: 'Seller ID is required' });

            const groupedCatalogs = await WearProduct.aggregate([
                { $match: { sellerId: new mongoose.Types.ObjectId(sellerId) } },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: { 
                            $cond: { 
                                if: { $or: [{ $eq: ["$catalogId", null] }, { $eq: ["$catalogId", ""] }, { $not: ["$catalogId"] }] }, 
                                then: "$_id", 
                                else: { $toString: "$catalogId" } 
                            } 
                        },
                        mainProduct: { $first: "$$ROOT" },
                        allProducts: { $push: "$$ROOT" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "mainProduct.createdAt": -1 } }
            ]);

            const catalogs = groupedCatalogs.map(g => ({
                ...g.mainProduct,
                _id: g.mainProduct._id,
                catalogId: g._id,
                similarProductsCount: g.count,
                similarProducts: g.allProducts
            }));

            responseReturn(res, 200, { success: true, products: catalogs });
        } catch (error) {
            console.error('Manual List Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // NEW: Dashboard: Get catalogs for a specific supplier
    get_supplier_catalogs = async (req, res) => {
        const { sellerId } = req.query;
        try {
            if (!sellerId) return responseReturn(res, 400, { error: 'sellerId is required' });
            const productModel = require('../../models/wear/productModel');

            // 1. Get Grouped Wear Catalogs
            const groupedCatalogs = await WearProduct.aggregate([
                { $match: { sellerId: new mongoose.Types.ObjectId(sellerId) } },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: { 
                            $cond: { 
                                if: { $or: [{ $eq: ["$catalogId", null] }, { $eq: ["$catalogId", ""] }, { $not: ["$catalogId"] }] }, 
                                then: "$_id", 
                                else: { $toString: "$catalogId" } 
                            } 
                        },
                        mainProduct: { $first: "$$ROOT" },
                        allProducts: { $push: "$$ROOT" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "mainProduct.createdAt": -1 } }
            ]);

            const wearCatalogs = groupedCatalogs.map(g => ({
                ...g.mainProduct,
                _id: g.mainProduct._id,
                catalogId: g.mainProduct.catalogId || g._id, // Assign accurate catalogId
                similarProductsCount: g.count,
                similarProducts: g.allProducts
            }));

            // 2. Get Legacy Products for this seller
            const legacyProductsRaw = await productModel.find({ sellerId: new mongoose.Types.ObjectId(sellerId) }).sort({ createdAt: -1 }).lean();

            const legacyCatalogs = legacyProductsRaw.map(p => ({
                ...p,
                productName: p.name,
                catalogId: p._id,
                variants: p.variants || [{
                    listingPrice: p.price,
                    mrp: p.price + (p.discount || 0),
                    size: 'Standard',
                    color: 'Multi',
                    stock: p.stock
                }],
                similarProductsCount: 1,
                similarProducts: [p],
                isLegacy: true,
                status: p.status || 'active'
            }));

            const allCatalogs = [...wearCatalogs, ...legacyCatalogs].sort((a, b) =>
                new Date(b.createdAt) - new Date(a.createdAt)
            );

            responseReturn(res, 200, { success: true, products: allCatalogs });
        } catch (error) {
            console.error('[Catalog] Fetch Supplier Catalogs Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Public: Get active catalogs for customers - One entry per catalogId
    get_public_catalogs = async (req, res) => {
        const { category, subCategory, search, campaignId, sort, filters, minPrice, maxPrice } = req.query;
        try {
            let matchQuery = { status: 'active' };
            let categoryRegexes = [];

            if (category) {
                const WearCategory = require('../../models/wear/wearCategoryModel');
                const catDoc = await WearCategory.findOne({ 
                    $or: [{ name: { $regex: new RegExp(`^${category}$`, 'i') } }, { slug: category.toLowerCase() }] 
                });

                if (catDoc) {
                    const childCategories = await WearCategory.find({ parentId: catDoc._id });
                    const categoryNames = [catDoc.name, ...childCategories.map(c => c.name)];
                    categoryRegexes = categoryNames.map(n => new RegExp(`^${n}$`, 'i'));
                    
                    matchQuery.$or = [
                        { category: { $in: categoryRegexes } },
                        { subCategory: { $in: categoryRegexes } }
                    ];
                } else {
                    const categoryRegex = { $regex: new RegExp(`^${category}$`, 'i') };
                    categoryRegexes = [categoryRegex];
                    matchQuery.$or = [
                        { category: categoryRegex },
                        { subCategory: categoryRegex }
                    ];
                }
            }

            if (campaignId) matchQuery.campaignId = campaignId;
            if (subCategory) matchQuery.subCategory = subCategory;

            // Price Filters
            if (minPrice || maxPrice) {
                const priceMatch = {};
                if (minPrice) priceMatch.$gte = parseFloat(minPrice);
                if (maxPrice) priceMatch.$lte = parseFloat(maxPrice);
                matchQuery["variants.0.listingPrice"] = priceMatch;
            }

            // Dynamic Attribute Filters
            if (filters) {
                try {
                    const parsedFilters = JSON.parse(filters);
                    const andQueries = [];
                    Object.keys(parsedFilters).forEach(key => {
                        const val = parsedFilters[key];
                        if (Array.isArray(val) ? val.length > 0 : !!val) {
                            const values = Array.isArray(val) ? val : [val];
                            const regexValues = values.map(v => new RegExp(`^${v}$`, 'i'));
                            andQueries.push({
                                attributes: {
                                    $elemMatch: {
                                        name: { $regex: `^${key}$`, $options: 'i' },
                                        value: { $in: regexValues }
                                    }
                                }
                            });
                        }
                    });
                    if (andQueries.length > 0) matchQuery.$and = andQueries;
                } catch (e) {
                    console.error("Filter parse error:", e);
                }
            }

            if (search) {
                matchQuery.$or = [
                    { productName: { $regex: search, $options: 'i' } },
                    { category: { $regex: search, $options: 'i' } },
                    { subCategory: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            // 1. Fetch Wear Catalogs
            const groupedCatalogs = await WearProduct.aggregate([
                { $match: matchQuery },
                { $sort: { isPrimary: -1, createdAt: -1 } },
                {
                    $lookup: {
                        from: 'suppliers',
                        localField: 'sellerId',
                        foreignField: '_id',
                        as: 'supplierInfo'
                    }
                },
                {
                    $addFields: {
                        supplier: {
                            businessName: { $arrayElemAt: ['$supplierInfo.businessDetails.shopName', 0] },
                            businessType: { $arrayElemAt: ['$supplierInfo.businessDetails.businessType', 0] }
                        }
                    }
                },
                {
                    $group: {
                        _id: { 
                            $cond: { 
                                if: { $or: [{ $eq: ["$catalogId", null] }, { $eq: ["$catalogId", ""] }, { $not: ["$catalogId"] }] }, 
                                then: "$_id", 
                                else: { $toString: "$catalogId" }
                            } 
                        },
                        mainProduct: { $first: "$$ROOT" },
                        allProducts: { $push: "$$ROOT" },
                        count: { $sum: 1 }
                    }
                },
                {
                    $lookup: {
                        from: 'wearreviews',
                        localField: '_id',
                        foreignField: 'catalogId',
                        as: 'catalogReviews'
                    }
                },
                {
                    $addFields: {
                        reviewCount: { $size: "$catalogReviews" },
                        avgRating: {
                            $cond: [
                                { $eq: [{ $size: "$catalogReviews" }, 0] },
                                0,
                                { $avg: "$catalogReviews.rating" }
                            ]
                        }
                    }
                }
            ]);

            const wearCatalogs = groupedCatalogs.map(g => ({
                ...g.mainProduct,
                catalogId: g._id,
                reviewCount: g.reviewCount,
                avgRating: g.avgRating ? Number(g.avgRating.toFixed(1)) : 0,
                similarProductsCount: g.count,
                similarProducts: g.allProducts
            }));

            // 2. Fetch Legacy Products (If no complex filters are present that legacy doesn't support)
            const legacyProductModel = require('../../models/wear/productModel');
            let legacyMatch = { status: 'active' };
            if (category) {
                if (categoryRegexes.length > 0) {
                    legacyMatch.category = { $in: categoryRegexes };
                } else {
                    legacyMatch.category = { $regex: new RegExp(`^${category}$`, 'i') };
                }
            }
            if (search) {
                legacyMatch.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { category: { $regex: search, $options: 'i' } }
                ];
            }

            const legacyProductsRaw = await legacyProductModel.find(legacyMatch).sort({ createdAt: -1 }).lean();
            const legacyCatalogs = legacyProductsRaw.map(p => ({
                ...p,
                productName: p.name,
                catalogId: p._id,
                variants: p.variants || [{
                    listingPrice: p.price,
                    mrp: p.price + (p.discount || 0),
                    size: 'Standard',
                    color: 'Multi',
                    stock: p.stock
                }],
                similarProductsCount: 1,
                similarProducts: [p],
                isLegacy: true
            }));

            // Combine and Sort
            let allProducts = [...wearCatalogs, ...legacyCatalogs];

            // Manual Sort
            if (sort === 'price_low') {
                allProducts.sort((a, b) => (a.variants?.[0]?.listingPrice || 0) - (b.variants?.[0]?.listingPrice || 0));
            } else if (sort === 'price_high') {
                allProducts.sort((a, b) => (b.variants?.[0]?.listingPrice || 0) - (a.variants?.[0]?.listingPrice || 0));
            } else if (sort === 'rating') {
                allProducts.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
            } else {
                allProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            }

            console.log(`[PublicCatalog] Returning ${allProducts.length} products total (${wearCatalogs.length} wear, ${legacyCatalogs.length} legacy)`);

            responseReturn(res, 200, { success: true, products: allProducts });
        } catch (error) {
            console.error('[PublicCatalog] Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 4. Update Catalog Status (Active/Inactive toggle)
    update_catalog_status = async (req, res) => {
        const { productId } = req.params;
        const { status } = req.body;
        const { role } = req;

        try {
            let productToUpdate = await WearProduct.findById(productId);
            let isWearProduct = true;

            if (!productToUpdate) {
                const legacyProductModel = require('../../models/wear/productModel');
                productToUpdate = await legacyProductModel.findById(productId);
                isWearProduct = false;
            }

            if (!productToUpdate) return responseReturn(res, 404, { error: 'Product not found' });

            // Dashboard Support: Admin and Seller can update any catalog. 
            // Suppliers can only update their OWN catalogs.
            const isAdminOrSeller = role === 'admin' || role === 'seller';
            
            if (!isAdminOrSeller) {
                if (role === 'supplier' || role === 'vendor') {
                    // Check ownership for suppliers
                    const supplier = await Supplier.findOne({ user: req.id });
                    if (!supplier || String(productToUpdate.sellerId) !== String(supplier._id)) {
                        return responseReturn(res, 403, { error: 'Not authorized: You do not own this catalog.' });
                    }
                } else {
                    return responseReturn(res, 403, { error: 'Not authorized: Invalid role.' });
                }
            }

            if (isWearProduct) {
                // Update entire catalog group status
                if (productToUpdate.catalogId) {
                    await WearProduct.updateMany(
                        { catalogId: productToUpdate.catalogId },
                        { $set: { status: status } }
                    );
                } else {
                    productToUpdate.status = status;
                    await productToUpdate.save();
                }
            } else {
                // Update legacy product
                productToUpdate.status = status;
                await productToUpdate.save();
            }

            responseReturn(res, 200, { success: true, message: `Status updated to ${status}` });
        } catch (error) {
            console.error('[Catalog] Status Update Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // 5. Delete Catalog
    delete_catalog = async (req, res) => {
        const { productId } = req.params;
        try {
            await WearProduct.findByIdAndDelete(productId);
            const legacyProductModel = require('../../models/wear/productModel');
            await legacyProductModel.findByIdAndDelete(productId);

            responseReturn(res, 200, { success: true, message: 'Catalog deleted successfully' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
    // Supplier: Get a specific catalog by catalogId (for edit pre-fill)
    get_catalog_by_id = async (req, res) => {
        const { catalogId } = req.params;
        const { id } = req;
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: 'Supplier not found' });

            let products = await WearProduct.find({
                catalogId,
                sellerId: supplier._id
            }).lean();

            if (!products || products.length === 0) {
                // Fallback: Check if catalogId passed was actually an _id
                if (catalogId.length === 24) {
                    const singleProduct = await WearProduct.findOne({
                        _id: catalogId,
                        sellerId: supplier._id
                    }).lean();
                    if (singleProduct) {
                        products = [singleProduct];
                    }
                }
            }

            if (!products || products.length === 0) {
                return responseReturn(res, 403, { error: 'Catalog not found or not authorized' });
            }

            // Return the same structure myCatalogs returns (primary + similarProducts)
            const primary = products.find(p => p.isPrimary) || products[0];
            const catalog = {
                ...primary,
                catalogId,
                similarProducts: products,
                similarProductsCount: products.length
            };

            responseReturn(res, 200, { success: true, catalog });
        } catch (error) {
            console.error('Get Catalog By ID Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Supplier: Edit their own catalog (resets status to 'pending' for re-review)
    supplier_edit_catalog = async (req, res) => {
        const { catalogId } = req.params;
        const { id } = req;
        const { products: updatedProducts, catalogInfo: info } = req.body;

        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: 'Supplier not found' });

            // Verify ownership
            let ownProducts = await WearProduct.find({ catalogId, sellerId: supplier._id });
            
            // Fallback for missing/legacy catalogId
            if ((!ownProducts || ownProducts.length === 0) && catalogId.length === 24) {
                const singleProduct = await WearProduct.findOne({ _id: catalogId, sellerId: supplier._id });
                if (singleProduct) ownProducts = [singleProduct];
            }

            if (!ownProducts || ownProducts.length === 0) {
                return responseReturn(res, 403, { error: 'Not authorized or catalog not found' });
            }

            const saved = [];

            for (const item of (updatedProducts || [])) {
                // Process any new base64 images
                const processedImages = [];
                if (item.images && Array.isArray(item.images)) {
                    for (const img of item.images) {
                        if (img.startsWith('data:image')) {
                            const url = await this.uploadImage(img);
                            if (url) processedImages.push(url);
                        } else {
                            processedImages.push(img);
                        }
                    }
                }

                const updatePayload = {
                    productName: info?.productName ? (updatedProducts.length > 1 ? `${info.productName} (${item.color})` : info.productName) : item.productName,
                    description: item.description || '',
                    category: info?.category || item.category,
                    subCategory: info?.subCategory || item.subCategory,
                    images: processedImages.length > 0 ? processedImages : item.images,
                    hsnCode: info?.hsnCode,
                    gstPercentage: info?.gstPercentage ? parseInt(info.gstPercentage) : undefined,
                    weight: info?.weight ? parseInt(info.weight) : undefined,
                    dimensions: info?.dimensions,
                    additionalDetails: item.highlights || item.additionalDetails,
                    variants: (item.variants || []).map(v => ({
                        ...v,
                        color: item.color,
                        listingPrice: parseFloat(v.listingPrice),
                        mrp: parseFloat(v.mrp),
                        stock: parseInt(v.stock),
                        priceTiers: (v.priceTiers || []).map(t => ({
                            minQty: parseInt(t.minQty),
                            price: parseFloat(t.price)
                        })).filter(t => !isNaN(t.minQty) && !isNaN(t.price))
                    })),
                    status: 'pending', // Reset to pending for re-review
                    updatedAt: new Date()
                };

                if (item._id && mongoose.Types.ObjectId.isValid(item._id)) {
                    const updated = await WearProduct.findByIdAndUpdate(item._id, updatePayload, { new: true });
                    if (updated) saved.push(updated);
                }
            }

            responseReturn(res, 200, {
                success: true,
                message: 'Catalog updated and submitted for re-review. It will be visible once approved.',
                data: saved
            });
        } catch (error) {
            console.error('Supplier Edit Catalog Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Public: Get HSN code + GST rate for a category (looked up from DB)
    get_hsn_tax_data = async (req, res) => {
        try {
            const WearCategory = require('../../models/wear/wearCategoryModel');
            const { category } = req.query;

            if (category) {
                // Find the category by name (case-insensitive) and return its HSN/GST
                const cat = await WearCategory.findOne({
                    name: { $regex: new RegExp(category, 'i') },
                    status: 'active'
                }).select('name hsnCode gstRate').lean();

                if (cat && cat.hsnCode) {
                    return responseReturn(res, 200, {
                        success: true,
                        suggestion: { hsn: cat.hsnCode, gst: cat.gstRate || 5, label: cat.name }
                    });
                }

                // Also try partial match on parent categories
                const partialCat = await WearCategory.findOne({
                    name: { $regex: new RegExp(category.split(' ')[0], 'i') },
                    hsnCode: { $ne: '' },
                    status: 'active'
                }).select('name hsnCode gstRate').lean();

                if (partialCat) {
                    return responseReturn(res, 200, {
                        success: true,
                        suggestion: { hsn: partialCat.hsnCode, gst: partialCat.gstRate || 5, label: partialCat.name }
                    });
                }

                return responseReturn(res, 200, { success: true, suggestion: null });
            }

            // Return all categories that have HSN codes configured
            const allCats = await WearCategory.find({ hsnCode: { $ne: '' }, status: 'active' })
                .select('name hsnCode gstRate')
                .lean();

            responseReturn(res, 200, {
                success: true,
                data: allCats.map(c => ({ label: c.name, hsn: c.hsnCode, gst: c.gstRate || 5 }))
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new wearCatalogController();
