const cardModel = require("../../models/wear/cardModel")
const { responseReturn } = require("../../utiles/response")
const { mongo: { ObjectId } } = require('mongoose')
const wishlistModel = require('../../models/wear/coreWishlistModel')

class cardController {

    add_to_card = async (req, res) => {
        const { userId, productId, quantity, size } = req.body
        try {
            const product = await cardModel.findOne({
                userId,
                productId,
                size: size || null
            })

            if (product) {
                responseReturn(res, 404, { error: 'Product Already Added To Card' })
            } else {
                const product = await cardModel.create({
                    userId,
                    productId,
                    quantity,
                    size: size || null
                })
                responseReturn(res, 201, { message: 'Product Added To Card Successfully', product })
            }
        } catch (error) {
            console.log(error.message)
            responseReturn(res, 500, { error: error.message })
        }
    }
    // END METHOD



    get_card_products = async (req, res) => {
        const { userId } = req.params;
        try {
            const card_products = await cardModel.aggregate([
                { $match: { userId: new ObjectId(userId) } },
                {
                    $lookup: {
                        from: 'products',
                        localField: 'productId',
                        foreignField: '_id',
                        as: 'products'
                    }
                },
                {
                    $lookup: {
                        from: 'wearproducts',
                        localField: 'productId',
                        foreignField: '_id',
                        as: 'wearProducts'
                    }
                }
            ]);

            const validItems = [];
            const outOfStockProduct = [];
            let card_product_count = 0;
            let calculatePrice = 0;
            let buy_product_item = 0;

            for (const item of card_products) {
                let productInfo = null;
                let stock = 0;
                let price = 0;
                let originalPrice = 0;
                let discount = 0;
                let sellerId = null;
                let shopName = "Jeenora Verified";

                // 1. Check Legacy Products
                if (item.products && item.products.length > 0) {
                    const p = item.products[0];
                    productInfo = p;
                    stock = p.stock;
                    originalPrice = p.price;
                    discount = p.discount;
                    sellerId = p.sellerId;
                    shopName = p.shopName;

                    if (discount !== 0) {
                        price = p.price - Math.floor((p.price * discount) / 100);
                    } else {
                        price = p.price;
                    }
                }
                // 2. Check Wear Products
                else if (item.wearProducts && item.wearProducts.length > 0) {
                    const p = item.wearProducts[0];
                    productInfo = p; // Return raw doc
                    sellerId = p.sellerId;

                    // Logic for variant
                    let variant = null;
                    if (p.variants && p.variants.length > 0) {
                        variant = p.variants.find(v => v.size === item.size) || p.variants[0];
                    }

                    stock = variant ? variant.stock : (p.stock || 0);
                    originalPrice = variant ? (variant.mrp || variant.listingPrice) : (p.price || 0);

                    // TIERED PRICING Logic
                    let finalPrice = variant ? variant.listingPrice : (p.price || 0);
                    if (variant && variant.priceTiers && variant.priceTiers.length > 0) {
                        const match = variant.priceTiers.sort((a, b) => b.minQty - a.minQty).find(t => item.quantity >= t.minQty);
                        if (match) finalPrice = match.price;
                    }
                    price = finalPrice;
                    discount = (variant && variant.mrp) ? Math.round(((variant.mrp - finalPrice) / variant.mrp) * 100) : 0;

                    // Attach normalized fields to productInfo (Strictly Whitelisted)
                    productInfo = {
                        _id: p._id,
                        name: p.productName,
                        images: p.images,
                        price: finalPrice,
                        originalPrice: variant ? (variant.mrp || variant.listingPrice) : (p.price || 0),
                        discount: discount,
                        brand: p.brand,
                        category: p.category,
                        shopName: p.shopName || "Jeenora Verified",
                        variants: p.variants || []
                    };
                }

                if (!productInfo) continue; // Skip invalid

                const cartItemObj = {
                    _id: item._id,
                    quantity: item.quantity,
                    size: item.size, 
                    productInfo: productInfo
                };

                if (stock < item.quantity) {
                    outOfStockProduct.push(cartItemObj);
                    card_product_count += item.quantity;
                } else {
                    validItems.push(cartItemObj);
                    card_product_count += item.quantity;
                    buy_product_item += item.quantity;
                    calculatePrice += (price * item.quantity);
                }
            }

            responseReturn(res, 200, {
                card_products: validItems, // Return FLAT LIST
                price: calculatePrice,
                card_product_count,
                shipping_fee: 20 * validItems.length, // Legacy logic
                outOfStockProduct,
                buy_product_item
            });

        } catch (error) {
            console.log(error.message);
            responseReturn(res, 500, { error: error.message });
        }
    }
    // END METHOD


    delete_card_products = async (req, res) => {
        const { card_id } = req.params
        try {
            await cardModel.findByIdAndDelete(card_id)
            responseReturn(res, 200, { message: 'Product Remove Successfully' })

        } catch (error) {
            console.log(error.message)

        }
    }

    // END METHOD

    quantity_inc = async (req, res) => {
        const { card_id } = req.params
        try {
            const product = await cardModel.findById(card_id)
            const { quantity } = product
            await cardModel.findByIdAndUpdate(card_id, { quantity: quantity + 1 })
            responseReturn(res, 200, { message: 'Quantity Updated' })

        } catch (error) {
            console.log(error.message)

        }
    }

    // END METHOD
    quantity_dec = async (req, res) => {
        const { card_id } = req.params
        try {
            const product = await cardModel.findById(card_id)
            const { quantity } = product
            await cardModel.findByIdAndUpdate(card_id, { quantity: quantity - 1 })
            responseReturn(res, 200, { message: 'Quantity Updated' })

        } catch (error) {
            console.log(error.message)

        }
    }

    // END METHOD


    add_wishlist = async (req, res) => {
        const { slug } = req.body
        try {
            const product = await wishlistModel.findOne({ slug })
            if (product) {
                responseReturn(res, 404, {
                    error: 'Product Is Already In Wishlist'
                })
            } else {
                await wishlistModel.create(req.body)
                responseReturn(res, 201, {
                    message: 'Product Add to Wishlist Success'
                })
            }
        } catch (error) {
            console.log(error.message)
        }
    }
    // End Method 

    get_wishlist = async (req, res) => {
        const { userId } = req.params
        try {
            const wishlists = await wishlistModel.find({
                userId
            })
            responseReturn(res, 200, { wishlistCount: wishlists.length, wishlists })
        } catch (error) {
            console.log(error.message)
        }
    }

    // END METHOD


    remove_wishlist = async (req, res) => {
        const { wishlistId } = req.params
        try {
            const wishlist = await wishlistModel.findByIdAndDelete(wishlistId)
            responseReturn(res, 200, { message: 'Wishlist Product Removed Successfully' }, wishlist)
        } catch (error) {
            console.log(error.message)
        }


    }

    //END METHOD

    wishlist_toggle = async (req, res) => {
        const { userId, productId } = req.body;
        try {
            const product = await wishlistModel.findOne({ userId, productId });
            if (product) {
                await wishlistModel.findByIdAndDelete(product._id);
                responseReturn(res, 200, { message: 'Removed from wishlist', success: true });
            } else {
                await wishlistModel.create(req.body);
                responseReturn(res, 201, { message: 'Added to wishlist', success: true });
            }
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}






module.exports = new cardController()
