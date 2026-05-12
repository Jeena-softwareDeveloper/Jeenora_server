const SupplierStock = require('../../models/wear/supplierStockModel');
const Seller = require('../../models/wear/sellerModel');

// ─── HSN → GST lookup (common garment codes) ─────────────────────────────────
const HSN_GST_MAP = {
    '6101': 12, '6102': 12, '6103': 12, '6104': 12,
    '6105': 5,  '6106': 5,  '6107': 5,  '6108': 5,
    '6109': 12, '6110': 12, '6111': 5,  '6112': 12,
    '6113': 12, '6114': 12, '6115': 12, '6116': 12,
    '6117': 12, '6201': 12, '6202': 12, '6203': 12,
    '6204': 12, '6205': 12, '6206': 12, '6207': 5,
    '6208': 5,  '6209': 5,  '6210': 12, '6211': 12,
    '6212': 12, '6213': 5,  '6214': 5,  '6215': 5,
    '6216': 12, '6217': 12, '5007': 5,  '5208': 5,
    '5209': 5,  '5210': 5,  '5211': 5,  '5212': 5,
};

// GET /wear/supplier/stock/hsn-gst?hsn=6206
const get_hsn_gst = async (req, res) => {
    try {
        const { hsn } = req.query;
        if (!hsn) return res.status(400).json({ error: 'HSN required' });
        const prefix = hsn.toString().substring(0, 4);
        const gst = HSN_GST_MAP[prefix] || null;
        return res.json({ success: true, gst, found: gst !== null });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// GET /wear/supplier/stock/list
const get_stock_list = async (req, res) => {
    try {
        const supplierId = req.id;
        const { status } = req.query; // optional filter

        const filter = { supplierId };
        if (status && status !== 'all') filter.status = status;

        const stocks = await SupplierStock.find(filter)
            .select('styleName styleCode category status variants images hsnCode gstPercent createdAt listingRequestedAt')
            .sort({ createdAt: -1 });

        // Compute summary per item
        const list = stocks.map(s => {
            const totalStock = s.variants.reduce((sum, v) => sum + v.stock, 0);
            const colors = [...new Set(s.variants.map(v => v.variantName))];
            const sizes = [...new Set(s.variants.map(v => v.size))];
            const minListingPrice = s.variants.length
                ? Math.min(...s.variants.map(v => v.listingPrice))
                : 0;
            const hasLowStock = s.variants.some(v => v.stock > 0 && v.stock <= 5);
            const hasOutOfStock = s.variants.some(v => v.stock === 0);
            return {
                _id: s._id,
                styleName: s.styleName,
                styleCode: s.styleCode,
                category: s.category,
                status: s.status,
                totalStock,
                colors,
                sizes,
                minListingPrice,
                image: s.images?.[0] || null,
                hsnCode: s.hsnCode,
                gstPercent: s.gstPercent,
                hasLowStock,
                hasOutOfStock,
                createdAt: s.createdAt,
                listingRequestedAt: s.listingRequestedAt
            };
        });

        return res.json({ success: true, stocks: list });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// GET /wear/supplier/stock/:id
const get_stock_detail = async (req, res) => {
    try {
        const supplierId = req.id;
        const stock = await SupplierStock.findOne({ _id: req.params.id, supplierId });
        if (!stock) return res.status(404).json({ error: 'Stock not found' });
        return res.json({ success: true, stock });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// POST /wear/supplier/stock/add
const add_stock = async (req, res) => {
    try {
        const supplierId = req.id;
        const {
            styleName, styleCode, category, subCategory,
            hsnCode, variants,
            weightGrams, lengthCm, widthCm, heightCm,
            piecesPerCarton, minOrderQty,
            images, washCare, fabricDetails
        } = req.body;

        if (!styleName || !styleCode || !hsnCode || !variants?.length) {
            return res.status(400).json({ error: 'styleName, styleCode, hsnCode, variants required' });
        }

        // Auto-fill GST from HSN — supplier cannot override
        const prefix = hsnCode.toString().substring(0, 4);
        const gstPercent = HSN_GST_MAP[prefix] || 5;

        // Check duplicate styleCode for this supplier
        const existing = await SupplierStock.findOne({ supplierId, styleCode });
        if (existing) {
            return res.status(400).json({ error: `Style code "${styleCode}" already exists` });
        }

        const newStock = new SupplierStock({
            supplierId, styleName, styleCode, category,
            subCategory: subCategory || '',
            hsnCode, gstPercent,
            variants, weightGrams, lengthCm, widthCm, heightCm,
            piecesPerCarton, minOrderQty,
            images: images || [],
            washCare: washCare || '',
            fabricDetails: fabricDetails || '',
            status: 'private'
        });

        await newStock.save();
        return res.status(201).json({ success: true, message: 'Stock added successfully', stockId: newStock._id });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// PATCH /wear/supplier/stock/:id — update fields while private
const update_stock = async (req, res) => {
    try {
        const supplierId = req.id;
        const stock = await SupplierStock.findOne({ _id: req.params.id, supplierId });
        if (!stock) return res.status(404).json({ error: 'Stock not found' });

        if (!['private', 'rejected'].includes(stock.status)) {
            return res.status(400).json({ error: 'Cannot edit stock that is pending or live' });
        }

        const allowedFields = [
            'styleName', 'category', 'subCategory', 'variants',
            'weightGrams', 'lengthCm', 'widthCm', 'heightCm',
            'piecesPerCarton', 'minOrderQty', 'images', 'washCare', 'fabricDetails'
        ];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) stock[field] = req.body[field];
        });

        // If HSN changed, recalculate GST
        if (req.body.hsnCode && req.body.hsnCode !== stock.hsnCode) {
            stock.hsnCode = req.body.hsnCode;
            const prefix = req.body.hsnCode.toString().substring(0, 4);
            stock.gstPercent = HSN_GST_MAP[prefix] || 5;
        }

        await stock.save();
        return res.json({ success: true, message: 'Stock updated' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// POST /wear/supplier/stock/:id/request-listing
const request_listing = async (req, res) => {
    try {
        const supplierId = req.id;
        const { supplierNote } = req.body;

        const stock = await SupplierStock.findOne({ _id: req.params.id, supplierId });
        if (!stock) return res.status(404).json({ error: 'Stock not found' });

        if (!['private', 'rejected'].includes(stock.status)) {
            return res.status(400).json({ error: 'Already submitted or live' });
        }

        if (!stock.images || stock.images.length < 1) {
            return res.status(400).json({ error: 'At least 1 image required before listing' });
        }

        stock.status = 'pending_approval';
        stock.supplierNote = supplierNote || '';
        stock.listingRequestedAt = new Date();
        await stock.save();

        return res.json({ success: true, message: 'Listing request submitted. Admin will review within 24-48 hours.' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// PATCH /wear/supplier/stock/:id/stock-update — update qty for a variant
const update_variant_stock = async (req, res) => {
    try {
        const supplierId = req.id;
        const { variantName, size, newStock } = req.body;

        const stock = await SupplierStock.findOne({ _id: req.params.id, supplierId });
        if (!stock) return res.status(404).json({ error: 'Stock not found' });

        const variant = stock.variants.find(v => v.variantName === color && v.size === size);
        if (!variant) return res.status(404).json({ error: 'Variant not found' });

        variant.stock = Math.max(0, Number(newStock));
        await stock.save();

        return res.json({ success: true, message: 'Stock updated' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// ── ADMIN ROUTES ─────────────────────────────────────────────────────────────

// GET /wear/admin/supplier-stock — list all pending for admin review
const admin_get_pending_stocks = async (req, res) => {
    try {
        const { status = 'pending_approval' } = req.query;
        const stocks = await SupplierStock.find({ status })
            .populate('supplierId', 'shopName name email phone')
            .sort({ listingRequestedAt: 1 });
        return res.json({ success: true, stocks });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// PATCH /wear/admin/supplier-stock/:id/review — approve or reject
const admin_review_stock = async (req, res) => {
    try {
        const { action, adminNote } = req.body; // action: 'approve' | 'reject'
        const stock = await SupplierStock.findById(req.params.id);
        if (!stock) return res.status(404).json({ error: 'Stock not found' });

        if (stock.status !== 'pending_approval') {
            return res.status(400).json({ error: 'Stock is not pending review' });
        }

        stock.adminNote = adminNote || '';
        stock.reviewedAt = new Date();
        stock.status = action === 'approve' ? 'active' : 'rejected';

        await stock.save();
        return res.json({
            success: true,
            message: action === 'approve' ? 'Stock approved and now live' : 'Stock rejected with note'
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

module.exports = {
    get_hsn_gst,
    get_stock_list,
    get_stock_detail,
    add_stock,
    update_stock,
    request_listing,
    update_variant_stock,
    admin_get_pending_stocks,
    admin_review_stock
};
