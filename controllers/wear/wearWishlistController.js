const Wishlist = require('../../models/wear/wishlistModel');
const { responseReturn } = require('../../utils/response');
const mongoose = require('mongoose');

class wearWishlistController {

    // Add product to wishlist
    add_to_wishlist = async (req, res) => {
        const { productId } = req.body;
        const { id } = req; // Buyer ID from auth middleware

        try {
            if (!productId) {
                return responseReturn(res, 400, { error: 'Product ID is required' });
            }

            let wishlist = await Wishlist.findOne({ userId: id });

            if (wishlist) {
                // Check if product already exists
                const productExists = wishlist.products.some(p => p.productId.toString() === productId);
                if (productExists) {
                    return responseReturn(res, 400, { error: 'Product already in wishlist' });
                }
                wishlist.products.push({ productId });
                await wishlist.save();
            } else {
                wishlist = await Wishlist.create({
                    userId: id,
                    products: [{ productId }]
                });
            }

            // Re-fetch to populate for consistency
            const updatedWishlist = await Wishlist.findOne({ userId: id }).populate('products.productId');
            const validProducts = updatedWishlist
                ? updatedWishlist.products
                    .filter(p => p.productId)
                    .map(p => ({
                        ...p.toObject(),
                        productId: p.productId
                    }))
                : [];

            responseReturn(res, 201, { message: 'Added to Wishlist', wishlist: validProducts });
        } catch (error) {
            console.error('Add to Wishlist Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Get user wishlist
    get_wishlist = async (req, res) => {
        const { id } = req;
        try {
            const wishlist = await Wishlist.findOne({ userId: id }).populate('products.productId');
            const validProducts = wishlist
                ? wishlist.products
                    .filter(p => p.productId) // Filter out nulls if product was deleted
                    .map(p => ({
                        ...p.toObject(),
                        productId: p.productId // Ensure the populated object is cleanly exposed
                    }))
                : [];
            responseReturn(res, 200, { wishlist: validProducts });
        } catch (error) {
            console.error('Get Wishlist Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Remove product from wishlist
    remove_from_wishlist = async (req, res) => {
        const { productId } = req.params;
        const { id } = req;

        try {
            const wishlist = await Wishlist.findOne({ userId: id });
            if (!wishlist) {
                return responseReturn(res, 404, { error: 'Wishlist not found' });
            }

            wishlist.products = wishlist.products.filter(p => p.productId.toString() !== productId);
            await wishlist.save();

            // Re-fetch to populate for consistency
            const updatedWishlist = await Wishlist.findOne({ userId: id }).populate('products.productId');
            const validProducts = updatedWishlist
                ? updatedWishlist.products
                    .filter(p => p.productId)
                    .map(p => ({
                        ...p.toObject(),
                        productId: p.productId
                    }))
                : [];

            responseReturn(res, 200, { message: 'Removed from Wishlist', wishlist: validProducts });
        } catch (error) {
            console.error('Remove form Wishlist Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new wearWishlistController();
