const ProductOffer = require('../../models/partner/productOfferModel');
const { responseReturn } = require('../../utils/response');

class productOfferController {
    // Add Offer
    add_offer = async (req, res) => {
        try {
            const { offerName, tag, title, subtitle, icon, iconColor, colors, status } = req.body;

            const offer = await ProductOffer.create({
                offerName, tag, title, subtitle, icon, iconColor, colors, status
            });

            responseReturn(res, 201, { offer, message: 'Offer added successfully' });
        } catch (error) {
            console.log(error.message);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Get Admin Offers
    get_admin_offers = async (req, res) => {
        try {
            const offers = await ProductOffer.find({}).sort({ createdAt: -1 });
            responseReturn(res, 200, { offers });
        } catch (error) {
            console.log(error.message);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Get Active Offers for App/Vendor
    get_active_offers = async (req, res) => {
        try {
            const offers = await ProductOffer.find({ status: 'active' }).sort({ createdAt: -1 });
            responseReturn(res, 200, { offers });
        } catch (error) {
            console.log(error.message);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Update Offer
    update_offer = async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const offer = await ProductOffer.findByIdAndUpdate(id, updateData, { new: true });

            responseReturn(res, 200, { offer, message: 'Offer updated successfully' });
        } catch (error) {
            console.log(error.message);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Delete Offer
    delete_offer = async (req, res) => {
        try {
            const { id } = req.params;
            await ProductOffer.findByIdAndDelete(id);
            responseReturn(res, 200, { message: 'Offer deleted successfully' });
        } catch (error) {
            console.log(error.message);
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new productOfferController();
