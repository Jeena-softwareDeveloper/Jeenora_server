const formidable = require("formidable")
const { responseReturn } = require("../../utils/response")
const cloudinary = require('cloudinary').v2
const sellerModel = require('../../models/wear/Seller')

class sellerController {

    request_seller_get = async (req, res) => {
        const { page, searchValue, parPage } = req.query
        const skipPage = parseInt(parPage) * (parseInt(page) - 1)

        try {
            if (searchValue) {

            } else {
                const sellers = await sellerModel.find({ status: 'pending' }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })
                const totalSeller = await sellerModel.find({ status: 'pending' }).countDocuments()
                responseReturn(res, 200, { sellers, totalSeller })
            }
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }

    }


    // end method 

    get_seller = async (req, res) => {
        const { sellerId } = req.params
        try {
            const seller = await sellerModel.findById(sellerId)
            responseReturn(res, 200, { seller })
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }
    }

    // end method 
    seller_status_update = async (req, res) => {
        const { sellerId, status } = req.body
        try {
            await sellerModel.findByIdAndUpdate(sellerId, { status })
            const seller = await sellerModel.findById(sellerId)
            responseReturn(res, 200, { seller, message: 'Seller Status Updated Successfully' })
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }
    }

    // end method 

    get_active_sellers = async (req, res) => {
        let { page, searchValue, parPage } = req.query
        page = parseInt(page)
        parPage = parseInt(parPage)

        const skipPage = parPage * (page - 1)

        try {
            if (searchValue) {
                const sellers = await sellerModel.find({
                    $text: { $search: searchValue },
                    status: 'active'
                }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })

                const totalSeller = await sellerModel.find({
                    $text: { $search: searchValue },
                    status: 'active'
                }).countDocuments()
                responseReturn(res, 200, { totalSeller, sellers })
            } else {
                const sellers = await sellerModel.find({

                    status: 'active'
                }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })

                const totalSeller = await sellerModel.find({

                    status: 'active'
                }).countDocuments()
                responseReturn(res, 200, { totalSeller, sellers })
            }
        } catch (error) {
            console.log('active seller get ' + error.message)
        }
    }

    // end method 

    get_deactive_sellers = async (req, res) => {
        let { page, searchValue, parPage } = req.query
        page = parseInt(page)
        parPage = parseInt(parPage)

        const skipPage = parPage * (page - 1)

        try {
            if (searchValue) {
                const sellers = await sellerModel.find({
                    $text: { $search: searchValue },
                    status: 'deactive'
                }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })

                const totalSeller = await sellerModel.find({
                    $text: { $search: searchValue },
                    status: 'deactive'
                }).countDocuments()
                responseReturn(res, 200, { totalSeller, sellers })
            } else {
                const sellers = await sellerModel.find({

                    status: 'deactive'
                }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })

                const totalSeller = await sellerModel.find({

                    status: 'deactive'
                }).countDocuments()
                responseReturn(res, 200, { totalSeller, sellers })
            }
        } catch (error) {
            console.log('deactive seller get ' + error.message)
        }
    }

    //END METHOD

    seller_profile_update = async (req, res) => {
        const { id } = req
        const form = formidable({ multiples: true })

        form.parse(req, async (err, fields, files) => {
            if (err) {
                return responseReturn(res, 500, { error: err.message })
            }

            const { shopName, division, district, sub_district } = fields
            const { image } = files

            cloudinary.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET,
                secure: true
            })

            try {
                let imgUrl = ""
                if (image) {
                    const result = await cloudinary.uploader.upload(image.filepath, { folder: 'profile' })
                    imgUrl = result.url
                }

                const seller = await sellerModel.findById(id)

                const shopInfo = {
                    shopName: shopName || seller.shopInfo?.shopName,
                    division: division || seller.shopInfo?.division,
                    district: district || seller.shopInfo?.district,
                    sub_district: sub_district || seller.shopInfo?.sub_district,
                }

                await sellerModel.findByIdAndUpdate(id, {
                    shopInfo,
                    image: imgUrl || seller.image
                })

                const updatedSeller = await sellerModel.findById(id)
                responseReturn(res, 200, { seller: updatedSeller, message: 'Profile Updated Successfully' })

            } catch (error) {
                responseReturn(res, 500, { error: error.message })
            }
        })
    }

}


module.exports = new sellerController()
