const couponModel = require("../../models/couponModel");
const productModel = require("../../models/wear/productModel");
const { responseReturn } = require("../../utiles/response");

class checkoutController {
    calculate_checkout = async (req, res) => {
        const { items, couponCode } = req.body; // items: [{productId, quantity}]
        try {
            let subTotal = 0;
            let totalDiscount = 0;
            let shippingFee = 50; // Flat fee or calculated

            const productDetails = [];

            for (const item of items) {
                const product = await productModel.findById(item.productId);
                if (product) {
                    const price = product.price;
                    const discount = (price * product.discount) / 100;
                    const finalPrice = price - discount;

                    subTotal += price * item.quantity;
                    totalDiscount += discount * item.quantity;

                    productDetails.push({
                        productId: product._id,
                        name: product.name,
                        price: price,
                        discount: product.discount,
                        quantity: item.quantity,
                        total: finalPrice * item.quantity
                    });
                }
            }

            let promoDiscount = 0;
            if (couponCode) {
                const coupon = await couponModel.findOne({ couponCode, status: 'active' });
                if (coupon) {
                    const currentTotal = subTotal - totalDiscount;
                    if (currentTotal >= coupon.minOrderValue) {
                        if (coupon.type === 'percentage') {
                            promoDiscount = (currentTotal * coupon.discount) / 100;
                            if (coupon.maxDiscount && promoDiscount > coupon.maxDiscount) {
                                promoDiscount = coupon.maxDiscount;
                            }
                        } else {
                            promoDiscount = coupon.discount;
                        }
                    }
                }
            }

            const totalAmount = subTotal - totalDiscount - promoDiscount + shippingFee;

            responseReturn(res, 200, {
                summary: {
                    subTotal,
                    totalDiscount,
                    promoDiscount,
                    shippingFee,
                    totalAmount
                },
                items: productDetails
            });

        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_coupons = async (req, res) => {
        try {
            const coupons = await couponModel.find({ status: 'active', endDate: { $gt: new Date() } });
            responseReturn(res, 200, { coupons });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new checkoutController();
