const formidable = require("formidable")
const { responseReturn } = require("../../utils/response")
const cloudinary = require('cloudinary').v2
const partnerModel = require('../../models/partner/Partner')

class partnerController {

    request_admin_get = async (req, res) => {
        const { page, searchValue, parPage } = req.query
        const skipPage = parseInt(parPage) * (parseInt(page) - 1)

        try {
            if (searchValue) {
                const admins = await partnerModel.find({
                    $text: { $search: searchValue },
                    status: 'pending'
                }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })
                const totalAdmin = await partnerModel.find({
                    $text: { $search: searchValue },
                    status: 'pending'
                }).countDocuments()
                responseReturn(res, 200, { admins, totalAdmin, partners: admins, totalPartner: totalAdmin })
            } else {
                const admins = await partnerModel.find({ status: 'pending' }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })
                const totalAdmin = await partnerModel.find({ status: 'pending' }).countDocuments()
                responseReturn(res, 200, { admins, totalAdmin, partners: admins, totalPartner: totalAdmin })
            }
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }
    }

    get_admin = async (req, res) => {
        const { adminId, partnerId } = req.params
        const targetId = adminId || partnerId
        try {
            const admin = await partnerModel.findById(targetId)
            responseReturn(res, 200, { admin, partner: admin })
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }
    }

    admin_status_update = async (req, res) => {
        const { adminId, partnerId, status } = req.body
        const targetId = adminId || partnerId
        try {
            await partnerModel.findByIdAndUpdate(targetId, { status })
            const admin = await partnerModel.findById(targetId)
            responseReturn(res, 200, { admin, partner: admin, message: 'Status Updated Successfully' })
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }
    }

    get_active_admins = async (req, res) => {
        let { page, searchValue, parPage } = req.query
        page = parseInt(page)
        parPage = parseInt(parPage)

        const skipPage = parPage * (page - 1)

        try {
            if (searchValue) {
                const admins = await partnerModel.find({
                    $text: { $search: searchValue },
                    status: 'active'
                }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })

                const totalAdmin = await partnerModel.find({
                    $text: { $search: searchValue },
                    status: 'active'
                }).countDocuments()
                responseReturn(res, 200, { totalAdmin, admins, totalPartner: totalAdmin, partners: admins })
            } else {
                const admins = await partnerModel.find({
                    status: 'active'
                }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })

                const totalAdmin = await partnerModel.find({
                    status: 'active'
                }).countDocuments()
                responseReturn(res, 200, { totalAdmin, admins, totalPartner: totalAdmin, partners: admins })
            }
        } catch (error) {
            console.log('active admin get ' + error.message)
        }
    }

    get_deactive_admins = async (req, res) => {
        let { page, searchValue, parPage } = req.query
        page = parseInt(page)
        parPage = parseInt(parPage)

        const skipPage = parPage * (page - 1)

        try {
            if (searchValue) {
                const admins = await partnerModel.find({
                    $text: { $search: searchValue },
                    status: 'deactive'
                }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })

                const totalAdmin = await partnerModel.find({
                    $text: { $search: searchValue },
                    status: 'deactive'
                }).countDocuments()
                responseReturn(res, 200, { totalAdmin, admins, totalPartner: totalAdmin, partners: admins })
            } else {
                const admins = await partnerModel.find({
                    status: 'deactive'
                }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })

                const totalAdmin = await partnerModel.find({
                    status: 'deactive'
                }).countDocuments()
                responseReturn(res, 200, { totalAdmin, admins, totalPartner: totalAdmin, partners: admins })
            }
        } catch (error) {
            console.log('deactive admin get ' + error.message)
        }
    }

    admin_profile_update = async (req, res) => {
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

                const admin = await partnerModel.findById(id)

                const shopInfo = {
                    shopName: shopName || admin.shopInfo?.shopName,
                    division: division || admin.shopInfo?.division,
                    district: district || admin.shopInfo?.district,
                    sub_district: sub_district || admin.shopInfo?.sub_district,
                }

                await partnerModel.findByIdAndUpdate(id, {
                    shopInfo,
                    image: imgUrl || admin.image
                })

                const updatedAdmin = await partnerModel.findById(id)
                responseReturn(res, 200, { admin: updatedAdmin, partner: updatedAdmin, message: 'Profile Updated Successfully' })

            } catch (error) {
                responseReturn(res, 500, { error: error.message })
            }
        })
    }
}

module.exports = new partnerController()
