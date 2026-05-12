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
    // --- HELPER: Format Product Name (Simple Version) ---
    _formatProductName = (productName) => {
        return productName || 'Unnamed Product';
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
                    const combo = `${(v.size || '').trim().toLowerCase()}-${(v.variantName || '').trim().toLowerCase()}`;
                    if (seenCombos.has(combo)) {
                        return responseReturn(res, 400, { error: `Duplicate variant detected for "${item.productName}": Size ${v.size}, Variant Name ${v.variantName}` });
                    }
                    seenCombos.add(combo);

                    // 2. Stock negative check
                    if (v.stock < 0) {
                        return responseReturn(res, 400, { error: `Stock cannot be negative for variant ${v.size}/${v.variantName} in product "${item.productName}".` });
                    }
                }

                // --- CATEGORY ID RESOLUTION ---
                const WearCategory = require('../../models/wear/wearCategoryModel');
                let catDoc = null;
                let subCatDoc = null;

                if (item.category) {
                    catDoc = await WearCategory.findOne({ 
                        $or: [{ name: item.category }, { _id: mongoose.Types.ObjectId.isValid(item.category) ? item.category : null }] 
                    });
                }
                if (item.subCategory) {
                    subCatDoc = await WearCategory.findOne({ 
                        $or: [{ name: item.subCategory }, { _id: mongoose.Types.ObjectId.isValid(item.subCategory) ? item.subCategory : null }] 
                    });
                }

                let product;
                if (item._id && mongoose.Types.ObjectId.isValid(item._id)) {
                    // 1. Update Existing Product
                    product = await WearProduct.findByIdAndUpdate(item._id, {
                        sellerId: supplier._id,
                        catalogId: sharedCatalogId,
                        catalogName: item.catalogName,
                        alterSlug: item.alterSlug,
                        tags: item.tags && typeof item.tags === 'string' ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : (Array.isArray(item.tags) ? item.tags : []),
                        productName: this._formatProductName(item.productName),
                        variants: (item.variants || []).map(v => {
                            const tiers = v.priceTiers || [];
                            const bestPrice = (item.isBulkOnly && tiers.length > 0) 
                                ? Math.min(...tiers.map(t => parseFloat(t.price))) 
                                : v.listingPrice;
                            return {
                                ...v,
                                listingPrice: bestPrice,
                                skuId: v.skuId || this.generateSKU(supplier.businessDetails?.shopName)
                            };
                        }),
                        minOrderQty: item.minOrderQty || 1,
                        isBulkOnly: item.isBulkOnly || false,
                        status: item.status || 'pending'
                    }, { new: true });
                } else {
                    // 2. Create New Product Variation
                    product = await WearProduct.create({
                        sellerId: supplier._id,
                        catalogId: sharedCatalogId,
                        catalogName: item.catalogName,
                        productName: this._formatProductName(item.productName),
                        description: item.description,
                        miniDescription: item.miniDescription,
                        detailedDescription: item.detailedDescription,
                        isPrimary: item.isPrimary,
                        category: item.category,
                        categoryId: catDoc ? catDoc._id : null,
                        subCategory: item.subCategory,
                        subCategoryId: subCatDoc ? subCatDoc._id : null,
                        images: processedImages,
                        hsnCode: item.hsnCode || this.generateHSN(item.category),
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
                        isBulkOnly: item.isBulkOnly || false,
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

            const wearCatalogs = groupedCatalogs.map(g => {
                // ALWAYS PRIORITIZE VARIANT NAME for Inventory Header
                const variantName = g.mainProduct.variants?.[0]?.variantName || g.mainProduct.variants?.[0]?.name;
                const finalName = variantName || g.mainProduct.productName;

                return {
                    _id: g._id, 
                    catalogId: g._id,
                    productName: finalName,
                    category: g.mainProduct.category,
                    images: [g.mainProduct.images?.[0]],
                    status: g.mainProduct.status,
                    hsnCode: g.mainProduct.hsnCode,
                    similarProductsCount: g.count,
                    createdAt: g.mainProduct.createdAt
                };
            });

            // 2. Get Legacy Products for this seller
            const legacyProductsRaw = await productModel.find({ sellerId: sellerObjectId }).sort({ createdAt: -1 }).lean();

            const legacyCatalogs = legacyProductsRaw.map(p => ({
                _id: p._id,
                catalogId: p._id,
                productName: p.name,
                category: p.category || 'Legacy',
                images: [p.images?.[0] || p.image],
                status: p.status || 'active',
                hsnCode: '',
                similarProductsCount: 1,
                isLegacy: true,
                createdAt: p.createdAt,
                price: p.price
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

            // If an admin edits, we should generally mark it as active (Accepted) unless they are explicitly rejecting it.
            // This ensures the supplier sees it as 'Accepted' and can manage stock/edits.
            if (productToUpdate.catalogId) {
                const newStatus = updateData.status || 'active';
                console.log(`[Admin] Syncing status to ${newStatus} for catalog: ${productToUpdate.catalogId}`);
                await WearProduct.updateMany(
                    { catalogId: productToUpdate.catalogId },
                    { $set: { status: newStatus } }
                );
            }

            // Also update the specific product with all details
            // Apply formatting to name if not explicitly disabled
            if (updateData.productName) {
                // Determine if this is a multicolor catalog to decide on suffix
                const isMultiVariant Name = (await WearProduct.countDocuments({ catalogId: productToUpdate.catalogId })) > 1;
                
                // CRITICAL FIX: Use the NEW color from updateData if provided, otherwise the existing color
                const currentVariantVariant Name = updateData.variants?.[0]?.variantName || productToUpdate.variants?.[0]?.variantName;
                
                updateData.productName = this._formatProductName(updateData.productName, currentVariantColor, isMultiColor);
            }

            console.log(`[Admin] Updating product ${productId} with data:`, JSON.stringify(updateData, null, 2));
            const updatedProduct = await WearProduct.findByIdAndUpdate(productId, updateData, { new: true });
            console.log(`[Admin] Updated product result:`, updatedProduct?.productName, updatedProduct?.variants?.[0]?.variantName);

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
                    variantName: 'Multi',
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

            const wearCatalogs = groupedCatalogs.map(g => {
                console.log(`[Inventory] --- Catalog Group: ${g._id} ---`);
                g.allProducts.forEach((p, idx) => {
                    console.log(`  Item ${idx + 1}: ID=${p._id} Name="${p.productName}" Color="${p.variants?.[0]?.variantName}"`);
                    
                    // AUTO-FIX: If name is doubled or messy, clean it now
                    const variantVariant Name = p.variants?.[0]?.variantName || '';
                    const correctName = this._formatProductName(p.productName, variantColor, g.allProducts.length > 1);
                    
                    if (p.productName !== correctName) {
                        console.log(`  -> Permanently fixing name in DB to: "${correctName}"`);
                        p.productName = correctName;
                        
                        // Also clean the variant color if it's messy
                        let cleanVariant Name = variantColor;
                        if (variantColor.length > 30) {
                            cleanVariant Name = variantColor.split('|')[0].replace(/Men's|Formal|Trousers|Slim Fit|Soft Cotton Blend/gi, '').trim();
                        }

                        // Save to DB in background
                        WearProduct.findByIdAndUpdate(p._id, { 
                            productName: correctName,
                            "variants.0.variantName": cleanVariant Name || variantColor
                        }).catch(err => console.error("Fix Save Error:", err));
                    }
                });
                
                return {
                    ...g.mainProduct,
                    _id: g.mainProduct._id,
                    catalogId: g.mainProduct.catalogId || g._id, // Assign accurate catalogId
                    similarProductsCount: g.count,
                    similarProducts: g.allProducts
                };
            });

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
                    variantName: 'Multi',
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
                const mongoose = require('mongoose');
                if (mongoose.Types.ObjectId.isValid(category)) {
                    matchQuery.$or = [
                        { categoryId: new mongoose.Types.ObjectId(category) },
                        { subCategoryId: new mongoose.Types.ObjectId(category) }
                    ];
                } else {
                    const categoryRegex = { $regex: new RegExp(`^${category}$`, 'i') };
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

            const wearCatalogs = groupedCatalogs.map(g => {
                const variantName = g.mainProduct.variants?.[0]?.variantName || g.mainProduct.variants?.[0]?.name;
                const finalName = variantName || g.mainProduct.productName;

                return {
                    ...g.mainProduct,
                    productName: finalName,
                    catalogId: g._id,
                    reviewCount: g.reviewCount,
                    avgRating: g.avgRating ? Number(g.avgRating.toFixed(1)) : 0,
                    similarProductsCount: g.count,
                    similarProducts: g.allProducts
                };
            });

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
                    variantName: 'Multi',
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
                // Check if user is a registered supplier
                const supplier = await Supplier.findOne({ user: req.id });
                if (supplier) {
                    // Check by sellerId OR catalogId ownership
                    const sellerIdMatch = String(productToUpdate.sellerId) === String(supplier._id);
                    const catalogOwned = productToUpdate.catalogId 
                        ? await WearProduct.findOne({ catalogId: productToUpdate.catalogId, sellerId: supplier._id })
                        : null;
                    if (!sellerIdMatch && !catalogOwned) {
                        return responseReturn(res, 403, { error: 'Not authorized: You do not own this catalog.' });
                    }
                } else {
                    return responseReturn(res, 403, { error: 'Not authorized: Invalid role.' });
                }
            }

            if (isWearProduct) {
                // If it belongs to a catalog group, update all products in that group
                if (productToUpdate.catalogId) {
                    await WearProduct.updateMany(
                        { catalogId: productToUpdate.catalogId },
                        { $set: { status: status } }
                    );
                } else {
                    // Update only the specific product
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
    scan_catalog_product = async (req, res) => {
        const { skuId } = req.params;
        const { id } = req; // user id

        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: 'Supplier account not found' });

            const query = skuId.toUpperCase();
            
            // Search by exact ObjectId or variant SKU
            let matchCondition = [{ 'variants.skuId': { $regex: new RegExp(`^${query}$`, 'i') } }];
            if (query.length === 24 && /^[0-9a-fA-F]{24}$/.test(query)) {
                 matchCondition.push({ _id: query });
            }

            let product = await WearProduct.findOne({
                sellerId: supplier._id,
                $or: matchCondition
            });

            // Fallback for 8-char sliced ObjectId
            if (!product && query.length === 8) {
                 const allProducts = await WearProduct.find({ sellerId: supplier._id }, '_id');
                 const match = allProducts.find(p => p._id.toString().slice(-8).toUpperCase() === query);
                 if (match) {
                     product = await WearProduct.findById(match._id);
                 }
            }

            if (!product) {
                return responseReturn(res, 404, { error: 'Product not found for this SKU' });
            }

            responseReturn(res, 200, { success: true, product });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

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

            // Optimization: If mode=list, return only essential fields for the expansion UI
            if (req.query.mode === 'list') {
                const catalog = {
                    _id: catalogId,
                    catalogId: catalogId,
                    similarProductsCount: products.length,
                    similarProducts: products.map(p => ({
                        _id: p._id,
                        catalogId: p.catalogId,
                        productName: p.productName,
                        images: [p.images?.[0]],
                        status: p.status,
                        hsnCode: p.hsnCode,
                        variants: p.variants?.map(v => ({
                            skuId: v.skuId,
                            stock: v.stock,
                            size: v.size,
                            variantName: v.variantName,
                            listingPrice: v.listingPrice,
                            mrp: v.mrp
                        }))
                    }))
                };
                return responseReturn(res, 200, { success: true, catalog });
            }

            // Default: Return FULL data for editing purposes
            const primary = products.find(p => p.isPrimary) || products[0];
            const catalog = {
                ...primary, // Spread all fields (name, desc, images, etc.)
                _id: primary._id,
                catalogId: catalogId,
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

                // Smart naming using helper
                const finalName = this._formatProductName(info?.productName || item.productName, item.variantName, updatedProducts.length > 1);

                const updatePayload = {
                    productName: finalName,
                    description: item.description || '',
                    category: info?.category || item.category,
                    subCategory: info?.subCategory || item.subCategory,
                    images: processedImages.length > 0 ? processedImages : item.images,
                    hsnCode: info?.hsnCode || '',
                    gstPercentage: info?.gstPercentage ? parseInt(info.gstPercentage) : undefined,
                    weight: info?.weight ? parseInt(info.weight) : undefined,
                    dimensions: info?.dimensions,
                    additionalDetails: item.highlights || item.additionalDetails,
                    variants: (item.variants || []).map(v => {
                        const tiers = (v.priceTiers || []).map(t => ({
                            minQty: parseInt(t.minQty),
                            price: parseFloat(t.price)
                        })).filter(t => !isNaN(t.minQty) && !isNaN(t.price));
                        
                        const bestPrice = (info?.isBulkOnly && tiers.length > 0)
                            ? Math.min(...tiers.map(t => t.price))
                            : parseFloat(v.listingPrice);

                        return {
                            ...v,
                            variantName: item.variantName,
                            listingPrice: bestPrice,
                            mrp: parseFloat(v.mrp),
                            stock: parseInt(v.stock),
                            priceTiers: tiers
                        };
                    }),
                    isBulkOnly: info?.isBulkOnly || false,
                    status: 'pending', // Reset to pending for re-review
                    updatedAt: new Date()
                };

                if (item._id && mongoose.Types.ObjectId.isValid(item._id)) {
                    console.log(`[SupplierEdit] Updating item ${item._id} with name: ${finalName} and variantName: ${item.variantName}`);
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

    // Public: Get real HSN code + GST rate for a category (set by admin in WearCategory)
    get_hsn_tax_data = async (req, res) => {
        try {
            const WearCategory = require('../../models/wear/wearCategoryModel');
            const { category } = req.query;

            if (category) {
                // Exact match first
                const cat = await WearCategory.findOne({
                    name: { $regex: new RegExp(`^${category}$`, 'i') },
                    status: 'active'
                }).select('name hsnCode gstRate').lean();

                if (cat) {
                    return responseReturn(res, 200, {
                        success: true,
                        suggestion: {
                            hsn: cat.hsnCode || '',
                            gst: cat.gstRate ?? 5,
                            label: cat.name
                        }
                    });
                }

                // Partial / parent category fallback
                const parentCat = await WearCategory.findOne({
                    name: { $regex: new RegExp(category, 'i') },
                    status: 'active'
                }).select('name hsnCode gstRate').lean();

                return responseReturn(res, 200, {
                    success: true,
                    suggestion: {
                        hsn: parentCat?.hsnCode || '',
                        gst: parentCat?.gstRate ?? 5,
                        label: parentCat?.name || category
                    }
                });
            }

            return responseReturn(res, 200, { success: true, suggestion: { hsn: '', gst: 5 } });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new wearCatalogController();
