const cloudinary = require('../../utiles/cloudinary')
const formidable = require('formidable')
const { responseReturn } = require('../../utiles/response')
const BannerModel = require('../../models/Awareness/bannerModel')

class BannerController {

    // Add Banner
    add_banner = async (req, res) => {
        const form = formidable({
            multiples: false,
            maxFileSize: 10 * 1024 * 1024 // 10MB
        })
        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 404, { error: 'Something went wrong' })

            const { title, description, isActive, startDate, endDate } = fields
            const { image } = files

            if (!title || !description || !image) {
                return responseReturn(res, 400, { error: 'All fields are required' })
            }

            const slug = title.split(' ').join('-').toLowerCase() + '-' + Date.now()

            try {
                const result = await cloudinary.uploader.upload(image.filepath, { folder: 'Awareness Banner' })

                const banner = await BannerModel.create({
                    title,
                    slug,
                    description,
                    image: result.secure_url,
                    startDate: startDate ? new Date(startDate) : Date.now(),
                    endDate: endDate ? new Date(endDate) : null,
                    isActive: isActive !== undefined ? isActive === 'true' : true
                })

                return responseReturn(res, 201, { banner, message: 'Banner Added Successfully' })
            } catch (error) {
                return responseReturn(res, 500, { error: error.message })
            }
        })
    }

    // Get All Banners (for dashboard - all status)
    get_admin_banners = async (req, res) => {
        try {
            let banners = await BannerModel.find().sort({ createdAt: -1 })
            banners = banners.map(b => {
                const bannerObj = b.toObject()
                if (bannerObj.image && bannerObj.image.includes("http://")) {
                    bannerObj.image = bannerObj.image.replace("http://", "https://")
                }
                return bannerObj
            })
            return responseReturn(res, 200, { banners })
        } catch (error) {
            return responseReturn(res, 500, { error: error.message })
        }
    }

    // Get Active Banners (for public site)
    get_banners = async (req, res) => {
        try {
            const now = new Date();
            let banners = await BannerModel.find({
                isActive: true
                // Removed overly restrictive date filtering for now to ensure seeded content shows
            }).sort({ createdAt: -1 })

            banners = banners.map(b => {
                const bannerObj = b.toObject()
                if (bannerObj.image && bannerObj.image.includes("http://")) {
                    bannerObj.image = bannerObj.image.replace("http://", "https://")
                }
                return bannerObj
            })
            return responseReturn(res, 200, { banners })
        } catch (error) {
            return responseReturn(res, 500, { error: error.message })
        }
    }

    // Track Click
    track_click = async (req, res) => {
        try {
            const banner = await BannerModel.findByIdAndUpdate(req.params.id, { $inc: { clickCount: 1 } }, { new: true });
            if (!banner) return responseReturn(res, 404, { error: 'Banner not found' });
            return responseReturn(res, 200, { success: true });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // Get Single Banner
    get_banner = async (req, res) => {
        try {
            let banner = await BannerModel.findById(req.params.id)
            if (!banner) return responseReturn(res, 404, { error: 'Banner not found' })

            banner = banner.toObject()
            if (banner.image && banner.image.includes("http://")) {
                banner.image = banner.image.replace("http://", "https://")
            }
            return responseReturn(res, 200, { banner })
        } catch (error) {
            return responseReturn(res, 500, { error: error.message })
        }
    }

    // Update Banner
    update_banner = async (req, res) => {
        const form = formidable({
            multiples: false,
            maxFileSize: 10 * 1024 * 1024 // 10MB
        })
        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 404, { error: 'Something went wrong' })

            const { title, description, isActive } = fields
            const { image } = files

            try {
                const banner = await BannerModel.findById(req.params.id)
                if (!banner) return responseReturn(res, 404, { error: 'Banner not found' })

                // Update fields
                if (title) {
                    banner.title = title
                    banner.slug = title.split(' ').join('-')
                }
                if (description) banner.description = description
                if (isActive !== undefined) banner.isActive = isActive === 'true'

                // If new image is uploaded
                if (image) {
                    const result = await cloudinary.uploader.upload(image.filepath, { folder: 'Awareness Banner' })
                    banner.image = result.secure_url
                }

                await banner.save()
                return responseReturn(res, 200, { banner, message: 'Banner updated successfully' })
            } catch (error) {
                return responseReturn(res, 500, { error: error.message })
            }
        })
    }

    // Delete Banner
    delete_banner = async (req, res) => {
        try {
            const banner = await BannerModel.findByIdAndDelete(req.params.id)
            if (!banner) return responseReturn(res, 404, { error: 'Banner not found' })
            return responseReturn(res, 200, { message: 'Banner deleted successfully' })
        } catch (error) {
            return responseReturn(res, 500, { error: error.message })
        }
    }

    // Toggle Banner Status (active/inactive)
    toggle_banner_status = async (req, res) => {
        try {
            const banner = await BannerModel.findById(req.params.id)
            if (!banner) return responseReturn(res, 404, { error: 'Banner not found' })

            banner.isActive = !banner.isActive
            await banner.save()

            return responseReturn(res, 200, {
                banner,
                message: `Banner is now ${banner.isActive ? 'active' : 'inactive'}`
            })
        } catch (error) {
            return responseReturn(res, 500, { error: error.message })
        }
    }

}

module.exports = new BannerController()
