const WearCart = require('../../models/wear/wearCartModel');
const WearProduct = require('../../models/wear/wearProductModel');

const wearCartController = {
    // 1. Add to Cart
    addToCart: async (req, res) => {
        try {
            const { productId, quantity, size, price } = req.body;
            const userId = req.user.id;

            console.log(`[ADD_TO_CART] User: ${userId}, Product: ${productId}, Size: ${size}`);

            // Check if item already exists in cart for this user with same size
            let cartItem = await WearCart.findOne({ userId, productId, size });

            if (cartItem) {
                // Update quantity if it exists
                cartItem.quantity += parseInt(quantity || 1);
                await cartItem.save();
                console.log(`[ADD_TO_CART] Updated existing item. New Qty: ${cartItem.quantity}`);
            } else {
                // Create new item
                cartItem = new WearCart({
                    userId,
                    productId,
                    quantity: quantity || 1,
                    size,
                    price
                });
                await cartItem.save();
                console.log(`[ADD_TO_CART] Created new cart item: ${cartItem._id}`);
            }

            res.status(200).json({ success: true, message: 'Item added to cart' });
        } catch (error) {
            console.error('[CART_ERROR]', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    },

    // 2. Get User Cart
    getCart: async (req, res) => {
        try {
            const userId = req.user.id;
            console.log(`[GET_CART] Fetching for User: ${userId}`);
            const cartItems = await WearCart.find({ userId })
                .select('-userId')
                .populate('productId', 'productName images variants sellerId');

            const mappedItems = cartItems.map(item => {
                const product = item.productId;
                if (!product) return item;

                // PRIORITIZE VARIANT NAME for Cart Items
                const variantName = product.variants?.[0]?.color || product.variants?.[0]?.name;
                const finalName = (variantName && variantName.length > 10) ? variantName : product.productName;

                return {
                    ...item.toObject(),
                    productId: {
                        ...product.toObject(),
                        productName: finalName
                    }
                };
            });

            console.log(`[GET_CART] Found ${cartItems.length} items for User ${userId}`);
            res.status(200).json({
                success: true,
                cartItems: mappedItems,
                totalItems: cartItems.length
            });
        } catch (error) {
            console.error('[CART_ERROR]', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    },

    // 3. Update Cart Quantity
    updateQuantity: async (req, res) => {
        try {
            const { cartId, quantity } = req.body;
            const userId = req.user.id;

            const cartItem = await WearCart.findOne({ _id: cartId, userId });
            if (!cartItem) {
                return res.status(404).json({ success: false, message: 'Cart item not found' });
            }

            cartItem.quantity = quantity;
            await cartItem.save();

            res.status(200).json({ success: true, message: 'Quantity updated' });
        } catch (error) {
            console.error('[CART_ERROR]', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    },

    // 4. Remove from Cart
    removeFromCart: async (req, res) => {
        try {
            const { cartId } = req.params;
            const userId = req.user.id;

            await WearCart.findOneAndDelete({ _id: cartId, userId });
            res.status(200).json({ success: true, message: 'Item removed from cart' });
        } catch (error) {
            console.error('[CART_ERROR]', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    },

    // 5. Clear Cart
    clearCart: async (req, res) => {
        try {
            const userId = req.user.id;
            await WearCart.deleteMany({ userId });
            res.status(200).json({ success: true, message: 'Cart cleared' });
        } catch (error) {
            console.error('[CART_ERROR]', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }
};

module.exports = wearCartController;
