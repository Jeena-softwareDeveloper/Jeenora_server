const wearBannerModel = require("../../models/wear/wearBannerModel");
const wearCategoryModel = require("../../models/wear/wearCategoryModel");
const { responseReturn } = require("../../utiles/response");
const cloudinary = require('cloudinary').v2;
const formidable = require("formidable");

class wearBannerController {

    // --- ADMIN CRUD ---

    add_banner = async (req, res) => {
        const form = formidable({ multiples: false });

        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 500, { error: "Form parsing failed" });

            const { title, bannerType, offerZones, filters, catalogIds, actionType, actionValue, priority, startDate, endDate } = fields;
            const imageFile = files.image;

            try {
                let imageUrl = fields.image;

                if (imageFile) {
                    const result = await cloudinary.uploader.upload(imageFile.filepath, { folder: 'wear_banners' });
                    imageUrl = result.secure_url;
                }

                if (!imageUrl) return responseReturn(res, 400, { error: "Image is required" });

                const banner = await wearBannerModel.create({
                    title,
                    image: imageUrl,
                    bannerType,
                    offerZones: Array.isArray(offerZones) ? offerZones : (typeof offerZones === 'string' ? JSON.parse(offerZones) : (offerZones ? [offerZones] : [])),
                    filters: typeof filters === 'string' ? JSON.parse(filters) : (filters || {}),
                    catalogId: Array.isArray(catalogIds) ? catalogIds : (typeof catalogIds === 'string' ? JSON.parse(catalogIds) : (catalogIds ? [catalogIds] : [])),
                    actionType: actionType || 'none',
                    actionValue: actionValue || 'none',
                    priority: parseInt(priority) || 0,
                    startDate: startDate || new Date(),
                    endDate: endDate || null
                });
                responseReturn(res, 201, { banner, message: "Banner created successfully" });
            } catch (error) {
                responseReturn(res, 500, { error: error.message });
            }
        });
    }

    get_all_banners = async (req, res) => {
        try {
            const banners = await wearBannerModel.find({}).sort({ createdAt: -1 });
            responseReturn(res, 200, { banners });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    update_banner = async (req, res) => {
        const { bannerId } = req.params;
        const form = formidable({ multiples: false });

        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 500, { error: "Form parsing failed" });

            const imageFile = files.image;

            try {
                let updateData = { ...fields };

                if (imageFile) {
                    const result = await cloudinary.uploader.upload(imageFile.filepath, { folder: 'wear_banners' });
                    updateData.image = result.secure_url;
                }

                if (updateData.filters && typeof updateData.filters === 'string') {
                    updateData.filters = JSON.parse(updateData.filters);
                }

                if (updateData.offerZones) {
                    updateData.offerZones = typeof updateData.offerZones === 'string' ? JSON.parse(updateData.offerZones) : updateData.offerZones;
                }

                if (updateData.catalogIds) {
                    updateData.catalogId = typeof updateData.catalogIds === 'string' ? JSON.parse(updateData.catalogIds) : updateData.catalogIds;
                }

                delete updateData.targetCategory; // Remove legacy field if sent

                const updatedBanner = await wearBannerModel.findByIdAndUpdate(bannerId, updateData, { new: true });
                responseReturn(res, 200, { banner: updatedBanner, message: "Banner updated" });
            } catch (error) {
                responseReturn(res, 500, { error: error.message });
            }
        });
    }

    delete_banner = async (req, res) => {
        const { bannerId } = req.params;
        try {
            await wearBannerModel.findByIdAndDelete(bannerId);
            responseReturn(res, 200, { message: "Banner deleted" });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // --- PUBLIC FETCHING ---

    /**
     * get_active_banners
     * Dynamically fetches banners based on category and current date.
     */
    get_active_banners = async (req, res) => {
        const { category, type } = req.query; // category slug or 'home'
        const now = new Date();

        try {
            let query = {
                isActive: true,
                startDate: { $lte: now },
                $and: [
                    {
                        $or: [
                            { endDate: { $exists: false } },
                            { endDate: { $eq: null } },
                            { endDate: { $gte: now } }
                        ]
                    }
                ]
            };

            if (category && category !== 'home') {
                query.offerZones = category;
            } else {
                // Global banners (Worldwide - Home Screen)
                // We show if 'home' is explicitly in the list OR if the list is empty/missing
                query.$and.push({
                    $or: [
                        { offerZones: 'home' },
                        { offerZones: { $size: 0 } },
                        { offerZones: { $exists: false } },
                        { offerZones: null }
                    ]
                });
            }

            if (type) {
                query.bannerType = type;
            }

            const banners = await wearBannerModel.find(query).sort({ priority: -1 });

            responseReturn(res, 200, { banners });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    /**
     * get_category_filters_for_banner
     * Helper for admin dashboard to auto-fetch available filters when selecting a category
     */
    get_category_filters_for_banner = async (req, res) => {
        const { categorySlug } = req.params;
        try {
            const category = await wearCategoryModel.findOne({ slug: categorySlug });
            if (!category) return responseReturn(res, 404, { error: "Category not found" });

            // Only show attributes/details marked as 'isFilter'
            const filters = [
                ...(category.attributes || []).filter(a => a.isFilter),
                ...(category.additionalDetails || []).filter(d => d.isFilter)
            ];

            responseReturn(res, 200, { filters });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // --- ANALYTICS ---
    track_click = async (req, res) => {
        const { bannerId } = req.params;
        try {
            await wearBannerModel.findByIdAndUpdate(bannerId, { $inc: { 'analytics.clicks': 1 } });
            responseReturn(res, 200, { success: true });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new wearBannerController();
