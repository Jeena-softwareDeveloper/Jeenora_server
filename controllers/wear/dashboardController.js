const { responseReturn } = require("../../utils/response")
const myShopWallet = require('../../models/wear/myShopWallet')
const productModel = require('../../models/wear/Product')
const customerOrder = require('../../models/wear/customerOrder')
const sellerModel = require('../../models/wear/Seller')
const adminSellerMessage = require('../../models/chat/adminSellerMessage')
const sellerWallet = require('../../models/wear/sellerWallet')
const authOrder = require('../../models/wear/AuthOrder')
const bannerModel = require('../../models/wear/bannerModel')
const cloudinary = require('cloudinary').v2
const formidable = require("formidable")
const sellerCustomerMessage = require('../../models/chat/sellerCustomerMessage')
const { mongo: { ObjectId } } = require('mongoose')


class dashboardController {
    get_admin_dashboard_data = async (req, res) => {
        const { id } = req
        try {
            const stats = await customerOrder.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$price' },
                        totalCommission: { $sum: '$totalCommission' }
                    }
                }
            ]);

            const subOrderStats = await authOrder.aggregate([
                {
                    $group: {
                        _id: null,
                        totalVendorPayable: { $sum: '$sellerAmount' }
                    }
                }
            ]);

            const totalProduct = await productModel.find({}).countDocuments();
            const totalOrder = await customerOrder.find({}).countDocuments();
            const totalSeller = await sellerModel.find({}).countDocuments();
            const messages = await adminSellerMessage.find({}).limit(3);
            const recentOrders = await customerOrder.find({}).limit(5);

            responseReturn(res, 200, {
                totalProduct,
                totalOrder,
                totalSeller,
                messages,
                recentOrders,
                totalRevenue: stats.length > 0 ? stats[0].totalRevenue : 0,
                totalCommission: stats.length > 0 ? stats[0].totalCommission : 0,
                totalVendorPayable: subOrderStats.length > 0 ? subOrderStats[0].totalVendorPayable : 0,
                totalSale: stats.length > 0 ? stats[0].totalRevenue : 0, // Using revenue as total sale equivalent
            });
        } catch (error) {
            console.log(error.message)
        }
    }
    //end Method 
    get_seller_dashboard_data = async (req, res) => {
        const { id, businessId, businessInfo } = req;
        try {
            // Define statuses that count as valid for dashboard metrics
            const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
            
            const statsAggregation = await authOrder.aggregate([
                {
                    $match: {
                        sellerId: new ObjectId(businessId),
                        payment_status: 'paid' // Strictly only paid orders for core stats
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalSales: { 
                            $sum: { 
                                $cond: [{ $eq: ['$delivery_status', 'delivered'] }, '$sellerAmount', 0] 
                            } 
                        },
                        totalOrders: { 
                            $sum: { 
                                $cond: [{ $in: ['$delivery_status', ['confirmed', 'processing', 'shipped', 'delivered']] }, 1, 0] 
                            } 
                        },
                        pendingConfirmation: {
                            $sum: { $cond: [{ $eq: ['$delivery_status', 'pending'] }, 1, 0] }
                        },
                        pendingShipments: {
                            $sum: { $cond: [{ $in: ['$delivery_status', ['confirmed', 'processing']] }, 1, 0] }
                        },
                        returnsCount: {
                            $sum: { $cond: [{ $eq: ['$delivery_status', 'returned'] }, 1, 0] }
                        }
                    }
                }
            ]);

            const dashboardStats = statsAggregation.length > 0 ? {
                ...statsAggregation[0],
                totalSales: Number(statsAggregation[0].totalSales.toFixed(2)) // Round to 2 decimals
            } : {
                totalSales: 0,
                totalOrders: 0,
                pendingConfirmation: 0,
                pendingShipments: 0,
                returnsCount: 0
            };

            const totalProduct = await productModel.find({
                sellerId: new ObjectId(businessId)
            }).countDocuments();

            const messages = await sellerCustomerMessage.find({
                $or: [{ senderId: id }, { receverId: id }]
            }).sort({ createdAt: -1 }).limit(3);

            const recentOrders = await authOrder.find({
                sellerId: new ObjectId(businessId),
                delivery_status: { $in: validStatuses }
            }).sort({ createdAt: -1 }).limit(5);

            // Fetch shopName and status from pre-resolved businessInfo (Supplier) or fallback to Legacy Seller
            let status = businessInfo?.status || 'none';
            let shopName = businessInfo?.businessDetails?.shopName || businessInfo?.shopInfo?.shopName || businessInfo?.name || 'My Shop';
            
            // If it's a legacy seller and we haven't fetched their info yet, do it now
            if (!businessInfo && !shopName) {
                const legacySeller = await sellerModel.findById(id);
                if (legacySeller) {
                    status = legacySeller.status;
                    shopName = legacySeller.shopInfo?.shopName || legacySeller.name;
                }
            }

            responseReturn(res, 200, {
                stats: {
                    ...dashboardStats,
                    totalProduct
                },
                status,
                shopName,
                messages,
                recentOrders
            });
        } catch (error) {
            console.log('[DASHBOARD_ERROR]', error.message);
            responseReturn(res, 500, { error: 'Failed to fetch dashboard data' });
        }
    }
    //end Method 
    add_banner = async (req, res) => {
        const form = formidable({ multiples: true })
        form.parse(req, async (err, field, files) => {
            const { productId } = field
            const { mainban } = files
            cloudinary.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET,
                secure: true
            })

            try {
                const { slug } = await productModel.findById(productId)
                const result = await cloudinary.uploader.upload(mainban.filepath, { folder: 'banners' })
                const banner = await bannerModel.create({
                    productId,
                    banner: result.url,
                    link: slug
                })
                responseReturn(res, 200, { banner, message: "Banner Add Success" })
            } catch (error) {
                responseReturn(res, 500, { error: error.message })
            }

        })
    }

    //end Method 
    get_banner = async (req, res) => {
        const { productId } = req.params
        try {
            const banner = await bannerModel.findOne({ productId: new ObjectId(productId) })
            responseReturn(res, 200, { banner })
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }
    }
    //end Method 
    update_banner = async (req, res) => {
        const { bannerId } = req.params
        const form = formidable({})
        form.parse(req, async (err, _, files) => {
            const { mainban } = files
            cloudinary.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET,
                secure: true
            })
            try {
                let banner = await bannerModel.findById(bannerId)
                let temp = banner.banner.split('/')
                temp = temp[temp.length - 1]
                const imageName = temp.split('.')[0]
                await cloudinary.uploader.destroy(imageName)
                const { url } = await cloudinary.uploader.upload(mainban.filepath, { folder: 'banners' })
                await bannerModel.findByIdAndUpdate(bannerId, {
                    banner: url
                })
                banner = await bannerModel.findById(bannerId)
                responseReturn(res, 200, { banner, message: "Banner Updated Success" })
            } catch (error) {
                responseReturn(res, 500, { error: error.message })
            }
        })
    }
    //end Method 
    get_banners = async (req, res) => {
        try {
            const banners = await bannerModel.aggregate([
                {
                    $sample: {
                        size: 5
                    }
                }
            ])
            responseReturn(res, 200, { banners })
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }
    }
    //end Method 
}
module.exports = new dashboardController()
