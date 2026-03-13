const WearOfferCampaign = require("../../models/wear/wearOfferCampaignModel");
const WearNotification = require("../../models/wear/wearNotificationModel");
const Supplier = require("../../models/wear/supplierModel");
const WearProduct = require("../../models/wear/wearProductModel");
const { responseReturn } = require("../../utiles/response");
const { getIo } = require("../../utiles/socket");
const formidable = require("formidable");
const { sendEmail } = require("../../utiles/emailSender");

class wearOfferController {

    // --- PRIVATE HELPERS ---
    _sync_expired_campaigns = async () => {
        const now = new Date();
        try {
            const expiredCampaigns = await WearOfferCampaign.find({
                $or: [
                    { endDate: { $lt: now } },
                    { isActive: false }
                ]
            }).select('_id');

            const expiredIds = expiredCampaigns.map(c => c._id);
            if (expiredIds.length === 0) return;

            const productsToRevert = await WearProduct.find({
                campaignId: { $in: expiredIds },
                'offerData.isCustomizedForOffer': true
            });

            if (productsToRevert.length > 0) {
                console.log(`[OfferSync] Reverting ${productsToRevert.length} products from expired campaigns...`);
                for (let product of productsToRevert) {
                    if (product.offerData?.originalProductName) {
                        product.productName = product.offerData.originalProductName;
                    }
                    if (product.offerData?.originalVariants?.length > 0) {
                        product.variants = product.offerData.originalVariants;
                    }
                    product.offerData.isCustomizedForOffer = false;
                    product.campaignId = undefined;
                    await product.save();
                }
            }

            await WearProduct.updateMany(
                { campaignId: { $in: expiredIds } },
                { $unset: { campaignId: "" } }
            );
        } catch (err) {
            console.error("[OfferSync] Error sync:", err.message);
        }
    }

    // --- ADMIN CRUD ---

    add_campaign = async (req, res) => {
        const form = formidable({ multiples: false });

        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 500, { error: "Form parsing failed" });

            const { title, description, startDate, endDate } = fields;

            try {
                const campaign = await WearOfferCampaign.create({
                    title,
                    description,
                    startDate: startDate || new Date(),
                    endDate: endDate || null
                });

                // --- NOTIFY ALL APPROVED SUPPLIERS ---
                const suppliers = await Supplier.find({ status: 'approved' }).select('user supplierDetails');

                if (suppliers.length > 0) {
                    console.log(`[OfferZone] Notifying ${suppliers.length} approved suppliers`);
                    const notifications = suppliers.map(s => ({
                        userId: s.user,
                        title: `New Offer Zone: ${title}`,
                        message: description,
                        type: 'offer',
                        category: 'Offer Zone',
                        metadata: { campaignId: campaign._id }
                    }));

                    await WearNotification.insertMany(notifications);
                    console.log(`[OfferZone] Inserted ${notifications.length} notifications into DB`);

                    // --- SEND EMAILS & SOCKETS ---
                    const emailSubject = `New Offer from Jeenora: ${title}`;
                    const emailBody = `A new promotion has been launched in the Offer Zone: "${title}". \n\nDetails: ${description} \n\nCheck your dashboard for more information.`;

                    try {
                        const io = getIo();
                        suppliers.forEach(s => {
                            const sid = s.user.toString();
                            console.log(`[OfferZone] Pushing socket/email to user: ${sid}`);

                            // Send Socket
                            io.to(sid).emit('wear_notification', {
                                title: `New Offer Zone: ${title}`,
                                message: description,
                                type: 'offer'
                            });

                            // Send Email (Non-blocking)
                            if (s.supplierDetails?.email) {
                                sendEmail(s.supplierDetails.email, emailSubject, emailBody);
                            }
                        });
                    } catch (notificationErr) {
                        console.log('Real-time notification or email batch failed, some notifications may not have delivered');
                    }
                }

                responseReturn(res, 201, { campaign, message: "Offer campaign created and suppliers notified" });
            } catch (error) {
                responseReturn(res, 500, { error: error.message });
            }
        });
    }

    get_all_campaigns = async (req, res) => {
        console.log(`[WearOffer] Fetching all campaigns...`);
        try {
            const campaigns = await WearOfferCampaign.find({}).sort({ createdAt: -1 });
            console.log(`[WearOffer] Found ${campaigns.length} campaigns`);
            responseReturn(res, 200, { campaigns });
        } catch (error) {
            console.error(`[WearOffer] Error fetching campaigns:`, error.message);
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_campaign_participants_admin = async (req, res) => {
        const { campaignId } = req.params;
        try {
            const participantIds = await WearProduct.distinct('sellerId', { campaignId });
            const suppliers = await Supplier.find({ _id: { $in: participantIds } }).select('businessDetails supplierDetails _id');

            const participants = await Promise.all(suppliers.map(async (s) => {
                const count = await WearProduct.countDocuments({ sellerId: s._id, campaignId });
                return {
                    ...s.toObject(),
                    productCount: count
                };
            }));

            responseReturn(res, 200, { participants });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_supplier_campaign_products_admin = async (req, res) => {
        const { campaignId, supplierId } = req.params;
        try {
            const products = await WearProduct.find({
                sellerId: supplierId,
                campaignId: campaignId
            });
            responseReturn(res, 200, { products });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    update_campaign = async (req, res) => {
        const { campaignId } = req.params;
        const form = formidable({ multiples: false });

        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 500, { error: "Form parsing failed" });

            try {
                const updatedCampaign = await WearOfferCampaign.findByIdAndUpdate(campaignId, fields, { new: true });
                responseReturn(res, 200, { campaign: updatedCampaign, message: "Campaign updated" });
            } catch (error) {
                responseReturn(res, 500, { error: error.message });
            }
        });
    }

    delete_campaign = async (req, res) => {
        const { campaignId } = req.params;
        try {
            await WearOfferCampaign.findByIdAndDelete(campaignId);
            responseReturn(res, 200, { message: "Campaign deleted" });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_active_campaigns = async (req, res) => {
        await this._sync_expired_campaigns();
        const now = new Date();
        const { id } = req; // Logged in user ID
        try {
            const campaigns = await WearOfferCampaign.find({
                isActive: true,
                startDate: { $lte: now },
                $or: [
                    { endDate: { $exists: false } },
                    { endDate: { $eq: null } },
                    { endDate: { $gte: now } }
                ]
            }).sort({ createdAt: -1 }).lean();

            let supplier = null;
            if (id) {
                supplier = await Supplier.findOne({ user: id });
            }

            if (supplier) {
                for (let campaign of campaigns) {
                    const products = await WearProduct.find({
                        sellerId: supplier._id,
                        campaignId: campaign._id
                    }).limit(3).select('images productName');

                    const count = await WearProduct.countDocuments({
                        sellerId: supplier._id,
                        campaignId: campaign._id
                    });
                    campaign.myProductsCount = count;
                    campaign.participatingPreview = products;
                }
            } else {
                // For Buyers/Guests: Show a generic preview of any 3 products in the campaign
                for (let campaign of campaigns) {
                    const products = await WearProduct.find({
                        campaignId: campaign._id,
                        status: 'active'
                    }).limit(3).select('images productName');
                    campaign.participatingPreview = products;
                }
            }

            console.log(`[OfferZone] Found ${campaigns.length} active campaigns for supplier app`);
            responseReturn(res, 200, { campaigns });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // --- NOTIFICATIONS ---

    get_my_notifications = async (req, res) => {
        try {
            const userId = req.id;
            console.log(`[WearNotification] Fetching notifications for user: ${userId}`);
            const notifications = await WearNotification.find({ userId }).sort({ createdAt: -1 });
            const unreadCount = await WearNotification.countDocuments({ userId, isRead: false });
            console.log(`[WearNotification] Found ${notifications.length} notifications`);
            responseReturn(res, 200, { notifications, unreadCount });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    mark_notification_read = async (req, res) => {
        const { notifId } = req.params;
        try {
            await WearNotification.findByIdAndUpdate(notifId, { isRead: true });
            responseReturn(res, 200, { message: "Notification marked as read" });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // --- PARTICIPATION ---

    get_campaign_details = async (req, res) => {
        const { campaignId } = req.params;
        try {
            const campaign = await WearOfferCampaign.findById(campaignId);
            if (!campaign) return responseReturn(res, 404, { error: "Campaign not found" });
            responseReturn(res, 200, { campaign });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_campaign_participation = async (req, res) => {
        const { campaignId } = req.params;
        const { id } = req; // Buyer/Supplier user ID
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: "Supplier not found" });

            const products = await WearProduct.find({
                sellerId: supplier._id,
                campaignId: campaignId
            });

            responseReturn(res, 200, { products });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    add_products_to_campaign = async (req, res) => {
        const { campaignId, productIds } = req.body;
        const { id } = req;
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: "Supplier not found" });

            // Update multiple products to belong to this campaign
            // Note: We ensure the products belong to this seller
            await WearProduct.updateMany(
                { _id: { $in: productIds }, sellerId: supplier._id },
                { campaignId: campaignId }
            );

            responseReturn(res, 200, { message: "Products successfully added to offer campaign" });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    remove_product_from_campaign = async (req, res) => {
        const { productId } = req.params;
        const { id } = req;
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: "Supplier not found" });

            const product = await WearProduct.findOne({ _id: productId, sellerId: supplier._id });
            if (!product) return responseReturn(res, 404, { error: "Product not found" });

            // Restore if backup exists
            if (product.offerData?.isCustomizedForOffer) {
                product.productName = product.offerData.originalProductName;
                product.variants = product.offerData.originalVariants;
                product.offerData.isCustomizedForOffer = false;
            }

            product.campaignId = undefined; // Remove campaign reference

            await product.save();
            responseReturn(res, 200, { message: "Product removed and original details restored" });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    update_product_limited = async (req, res) => {
        const { productId, productName, listingPrice, mrp } = req.body;
        const { id } = req;
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) return responseReturn(res, 404, { error: "Supplier not found" });

            const product = await WearProduct.findOne({ _id: productId, sellerId: supplier._id });
            if (!product) return responseReturn(res, 404, { error: "Product not found" });

            // --- BACKUP ORIGINAL DATA (Only if not already backed up) ---
            if (!product.offerData?.isCustomizedForOffer) {
                product.offerData = {
                    originalProductName: product.productName,
                    originalVariants: JSON.parse(JSON.stringify(product.variants)), // Deep copy
                    isCustomizedForOffer: true
                };
            }

            if (productName) product.productName = productName;
            if (listingPrice !== undefined) {
                product.variants = product.variants.map(v => ({
                    ...v,
                    listingPrice: parseFloat(listingPrice),
                    mrp: mrp ? parseFloat(mrp) : (v.mrp || parseFloat(listingPrice))
                }));
            }

            await product.save();
            responseReturn(res, 200, { message: "Product details updated for offer", product });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new wearOfferController();
