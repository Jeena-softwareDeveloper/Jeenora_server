const formidable = require("formidable")
const { responseReturn } = require("../../utils/response")
const cloudinary = require('cloudinary').v2
const productModel = require('../../models/partner/Product')

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

class productController {
    add_product = async (req, res) => {
        const { id } = req;
        const form = formidable({ multiples: true });

        form.parse(req, async (err, field, files) => {
            if (err) {
                return responseReturn(res, 500, { error: 'Form parsing failed' });
            }
            let { name, category, description, stock, price, discount, shopName, brand, gstPercentage } = field;
            let { images } = files;

            if (!Array.isArray(images)) {
                images = [images]; // Assurez-vous que images est un tableau
            }

            name = name.trim();
            const slug = name.split(' ').join('-');

            try {
                let allImageUrl = [];


                for (let i = 0; i < images.length; i++) {
                    try {
                        const result = await cloudinary.uploader.upload(images[i].filepath, { folder: 'products' });
                        allImageUrl.push(result.url);
                    } catch (uploadError) {
                        console.error('Cloudinary upload error:', uploadError);
                        return responseReturn(res, 500, { error: 'Image upload failed' });

                    }
                }
                await productModel.create({
                    partnerId: id,
                    name,
                    slug,
                    shopName,
                    category: category.trim(),
                    description: description.trim(),
                    stock: parseInt(stock),
                    price: parseInt(price),
                    discount: parseInt(discount),
                    images: allImageUrl,
                    brand: brand.trim(),
                    gstPercentage: parseInt(gstPercentage) || 0,
                });

                responseReturn(res, 201, { message: 'Product Added Successfully' });

            } catch (error) {
                console.error('Product creation error:', error);
                responseReturn(res, 500, { error: error.message });
            }
        });
    };

    

    products_get = async (req, res) => {
        const { page, searchValue, parPage } = req.query
        const { id } = req;

        const skipPage = parseInt(parPage) * (parseInt(page) - 1)

        try {
            if (searchValue) {
                const products = await productModel.find({
                    $text: { $search: searchValue },
                    partnerId: id
                }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })
                const totalProduct = await productModel.find({
                    $text: { $search: searchValue },
                    partnerId: id
                }).countDocuments()
                responseReturn(res, 200, { products, totalProduct })
            } else {

                const products = await productModel.find({ partnerId: id }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })
                const totalProduct = await productModel.find({ partnerId: id }).countDocuments()
                responseReturn(res, 200, { products, totalProduct })


            }

        } catch (error) {
        }

    }


    


    product_get = async (req, res) => {
        const { productId } = req.params
        try {
            const product = await productModel.findById(productId)
            responseReturn(res, 200, { product })

        } catch (error) {
        }
    }

    



    product_update = async (req, res) => {
        let { name, category, description, stock, price, discount, brand, productId, gstPercentage } = req.body;
        const { id } = req;
        name = name.trim();
        const slug = name.split(' ').join('-');

        try {
            const product = await productModel.findById(productId)
            if (!product) {
                return responseReturn(res, 404, { error: 'Product not found' })
            }
            if (product.partnerId.toString() !== id && req.role !== 'admin') {
                return responseReturn(res, 403, { error: 'You are not authorized to update this product' })
            }

            await productModel.findByIdAndUpdate(productId, {
                name, description, stock, price, discount, brand,
                gstPercentage: parseInt(gstPercentage) || 0,
                slug
            })
            const updatedProduct = await productModel.findById(productId)
            responseReturn(res, 200, { product: updatedProduct, message: 'Product Updated Successfully' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
    
    product_image_update = async (req, res) => {
        const form = formidable({ multiples: true })

        form.parse(req, async (err, field, files) => {
            const { oldImage, productId } = field;
            const { newImage } = files

            if (err) {
                responseReturn(res, 400, { error: err.message })
            } else {
                try {

                    const result = await cloudinary.uploader.upload(newImage.filepath, { folder: 'products' })

                    if (result) {
                        let { images } = await productModel.findById(productId)
                        const index = images.findIndex(img => img === oldImage)
                        images[index] = result.url;
                        await productModel.findByIdAndUpdate(productId, { images })

                        const product = await productModel.findById(productId)
                        responseReturn(res, 200, { product, message: 'Product Image Updated Successfully' })

                    } else {
                        responseReturn(res, 404, { error: 'Image Upload Failed' })
                    }


                } catch (error) {
                    responseReturn(res, 404, { error: error.message })
                }
            }



        })
    }
    


    deleteProduct = async (req, res) => {
        const productId = req.params.id;
        const { id, role } = req;
        try {
            const product = await productModel.findById(productId);
            if (!product) {
                return responseReturn(res, 200, { message: 'Product not found' });
            }
            if (product.partnerId.toString() !== id && role !== 'admin') {
                return responseReturn(res, 200, { message: 'You are not authorized to delete this product' });
            }

            await productModel.findByIdAndDelete(productId);
            responseReturn(res, 200, { message: 'Product deleted successfully' });
        } catch (error) {
            responseReturn(res, 200, { message: 'Internal Server Error' });
        }
    }

    





}

module.exports = new productController()
