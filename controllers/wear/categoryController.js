const formidable = require("formidable")
const { responseReturn } = require("../../utils/response")
const cloudinary = require('cloudinary').v2
const categoryModel = require('../../models/wear/Category')

class categoryController {

    add_category = async (req, res) => {
        const form = formidable()
        form.parse(req, async (err, fields, files) => {
            if (err) {
                responseReturn(res, 404, { error: 'something went wrong' })
            } else {
                let { name, priority } = fields
                let { image } = files
                name = name.trim()
                const slug = name.split(' ').join('-')

                cloudinary.config({
                    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                    api_key: process.env.CLOUDINARY_API_KEY,
                    api_secret: process.env.CLOUDINARY_API_SECRET,
                    secure: true
                })

                try {
                    const removeBackground = fields.removeBackground === 'true' || fields.removeBackground === true;
                    const uploadOptions = { folder: 'categorys' };
                    if (removeBackground) {
                        uploadOptions.background_removal = "cloudinary_ai";
                        uploadOptions.format = 'png';
                    }

                    const result = await cloudinary.uploader.upload(image.filepath, uploadOptions);

                    if (result && result.secure_url) {
                        const category = await categoryModel.create({
                            name,
                            slug,
                            image: result.secure_url,
                            priority: parseInt(priority) || 0
                        })
                        responseReturn(res, 201, { category, message: 'Category Added Successfully' })
                    } else {
                        throw new Error('Cloudinary upload failed');
                    }
                } catch (error) {
                    console.error('Category Add Error:', error.message);
                    responseReturn(res, 500, { error: `Upload Failed: ${error.message}` })
                }




            }

        })
    }


    get_category = async (req, res) => {
        const { page, searchValue, parPage } = req.query

        try {
            let skipPage = ''
            if (parPage && page) {
                skipPage = parseInt(parPage) * (parseInt(page) - 1)

            }

            if (searchValue && page && parPage) {
                const categorys = await categoryModel.find({
                    $text: { $search: searchValue }
                }).skip(skipPage).limit(parPage).sort({ priority: 1, createdAt: -1 })
                const totalCategory = await categoryModel.find({
                    $text: { $search: searchValue }
                }).countDocuments()
                responseReturn(res, 200, { categorys, totalCategory })
            }
            else if (searchValue === '' && page && parPage) {

                const categorys = await categoryModel.find({}).skip(skipPage).limit(parPage).sort({ priority: 1, createdAt: -1 })
                const totalCategory = await categoryModel.find({}).countDocuments()
                responseReturn(res, 200, { categorys, totalCategory })


            }



            else {

                const categorys = await categoryModel.find({}).sort({ priority: 1, createdAt: -1 })
                const totalCategory = await categoryModel.find({}).countDocuments()
                responseReturn(res, 200, { categorys, totalCategory })

            }

        } catch (error) {
            console.log(error.message)

        }
    }
    //END METHOD

    update_category = async (req, res) => {
        const form = formidable()
        form.parse(req, async (err, fields, files) => {
            if (err) {
                responseReturn(res, 404, { error: 'something went wrong' })
            } else {
                let { name, priority } = fields
                let { image } = files
                const { id } = req.params;
                name = name.trim()
                const slug = name.split(' ').join('-')
                try {
                    let result = null;
                    if (image) {
                        cloudinary.config({
                            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                            api_key: process.env.CLOUDINARY_API_KEY,
                            api_secret: process.env.CLOUDINARY_API_SECRET,
                            secure: true
                        });
                        result = await cloudinary.uploader.upload(image.filepath, { folder: 'categorys' })
                    }
                    const updateData = {
                        name,
                        slug,
                        priority: parseInt(priority) || 0
                    }
                    if (result) {
                        updateData.image = result.url;
                    }

                    const category = await categoryModel.findByIdAndUpdate(id, updateData, { new: true });
                    responseReturn(res, 200, { category, message: 'Category Updated successfully' })

                } catch (error) {
                    responseReturn(res, 500, { error: 'Internal Server Error' })
                }
            }

        })
    }
    // end method

    deleteCategory = async (req, res) => {
        try {
            const categoryId = req.params.id;
            const deleteCategory = await categoryModel.findByIdAndDelete(categoryId);
            if (!deleteCategory) {
                console.log(`Cateogry with id ${categoryId} not found`);
                return res.status(404).json({ message: 'Category not found' });
            }
            res.status(200).json({ message: 'Category deleted successfully' });

        } catch (error) {
            console.log(`Error delete category with id ${categoryId}:`, error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
    // end method

}


module.exports = new categoryController()
