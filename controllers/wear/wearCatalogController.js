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
                        catalogId: item.catalogId,
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
                        catalogId: item.catalogId,
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
                message: `${createdProducts.length} product(s) uploaded successfully to catalog ${productsToCreate[0]?.catalogId}.`,
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

            console.log(`[Inventory] Supplier found: ${supplier._id}`);

            // Debug: Check count before aggregation
            const rawCount = await WearProduct.countDocuments({ sellerId: supplier._id });
            console.log(`[Inventory] Raw product count (simple find) for seller ${supplier._id}: ${rawCount}`);

            // Ensure sellerId is an ObjectId for aggregation
            const sellerObjectId = new mongoose.Types.ObjectId(String(supplier._id));

            // Use aggregation to group by catalogId
            const groupedCatalogs = await WearProduct.aggregate([
                { $match: { sellerId: sellerObjectId } },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: "$catalogId",
                        mainProduct: { $first: "$$ROOT" }, // Get the most recent or primary
                        allProducts: { $push: "$$ROOT" },
                        count: { $sum: 1 },
                        status: { $first: "$status" }
                    }
                },
                { $sort: { "mainProduct.createdAt": -1 } }
            ]);

            console.log(`[Inventory] Aggregated Groups: ${groupedCatalogs.length}`);

            // Map back to a cleaner structure for UI
            const catalogs = groupedCatalogs.map(g => ({
                ...g.mainProduct,
                _id: g.mainProduct._id, // Keep the ID of the main product for reference
                catalogId: g._id,
                similarProductsCount: g.count,
                similarProducts: g.allProducts
            }));

            responseReturn(res, 200, { success: true, catalogs });
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
                        _id: "$catalogId",
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
                        _id: "$catalogId",
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
                        _id: "$catalogId",
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
                catalogId: g._id,
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
                        _id: "$catalogId",
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

            // Dashboard Support: Admin and Seller (Dashboard users) can update any catalog
            const isDashboardUser = role === 'admin' || role === 'seller';
            if (!isDashboardUser) {
                return responseReturn(res, 403, { error: 'Not authorized' });
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
}

module.exports = new wearCatalogController();
