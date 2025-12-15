const cloudinary = require('../../utiles/cloudinary');
const formidable = require('formidable');
const { responseReturn } = require('../../utiles/response');
const ImageModel = require('../../models/Awareness/imageModel');

class ImageController {

    // -------------------- Add Image -------------------- //
    add_image = async (req, res) => {
        const form = formidable({ multiples: false, keepExtensions: true });

        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 500, { error: 'Something went wrong during file parsing' });

            const { heading, description, miniDescription, isActive } = fields;
            const { image } = files;

            if (!heading || !description || !miniDescription || !image?.filepath) {
                return responseReturn(res, 400, { error: 'All fields including image are required' });
            }

            try {
                const slug = heading.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
                const result = await cloudinary.uploader.upload(image.filepath, {
                    folder: 'Awareness Image',
                    resource_type: 'auto'
                });

                const savedImage = await ImageModel.create({
                    heading,
                    slug,
                    description,
                    miniDescription,
                    image: result.secure_url,
                    isActive: isActive === 'true' || isActive === true
                });

                return responseReturn(res, 201, { image: savedImage, message: 'Image created successfully' });
            } catch (error) {
                if (error.name === 'ValidationError') {
                    return responseReturn(res, 400, { error: error.message });
                }
                return responseReturn(res, 500, { error: error.message });
            }
        });
    }

    // -------------------- Get All Images -------------------- //
    get_images = async (req, res) => {
        try {
            let images = await ImageModel.find().sort({ createdAt: -1 });
            images = images.map(img => {
                const imgObj = img.toObject();
                if (imgObj.image && imgObj.image.includes("http://")) {
                    imgObj.image = imgObj.image.replace("http://", "https://");
                }
                return imgObj;
            });
            return responseReturn(res, 200, { images });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // -------------------- Get Single Image -------------------- //
    get_image = async (req, res) => {
        const { id } = req.params;
        try {
            let imageData = await ImageModel.findById(id);
            if (!imageData) return responseReturn(res, 404, { error: 'Image not found' });

            imageData = imageData.toObject();
            if (imageData.image && imageData.image.includes("http://")) {
                imageData.image = imageData.image.replace("http://", "https://");
            }
            return responseReturn(res, 200, { image: imageData });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // -------------------- Update Image -------------------- //
    update_image = async (req, res) => {
        const form = formidable({ multiples: false, keepExtensions: true });

        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 500, { error: 'Something went wrong during file parsing' });

            const { heading, description, miniDescription, isActive } = fields;
            const { image: uploadedImage } = files;
            const { id } = req.params;

            try {
                const imageData = await ImageModel.findById(id);
                if (!imageData) return responseReturn(res, 404, { error: 'Image not found' });

                // Update fields if provided
                if (heading) {
                    imageData.heading = heading;
                    imageData.slug = heading.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
                }
                if (description) imageData.description = description;
                if (miniDescription) imageData.miniDescription = miniDescription;
                if (isActive !== undefined) imageData.isActive = isActive === 'true' || isActive === true;

                // Upload new image if provided
                if (uploadedImage?.filepath) {
                    const result = await cloudinary.uploader.upload(uploadedImage.filepath, {
                        folder: 'Awareness Image',
                        resource_type: 'auto'
                    });
                    imageData.image = result.secure_url;
                }

                await imageData.save();
                return responseReturn(res, 200, { image: imageData, message: 'Image updated successfully' });
            } catch (error) {
                if (error.name === 'ValidationError') {
                    return responseReturn(res, 400, { error: error.message });
                }
                return responseReturn(res, 500, { error: error.message });
            }
        });
    }

    // -------------------- Delete Image -------------------- //
    delete_image = async (req, res) => {
        const { id } = req.params;
        try {
            const imageData = await ImageModel.findByIdAndDelete(id);
            if (!imageData) return responseReturn(res, 404, { error: 'Image not found' });
            return responseReturn(res, 200, { image: imageData, message: 'Image deleted successfully' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // -------------------- Toggle Image Status -------------------- //
    toggle_image_status = async (req, res) => {
        const { id } = req.params;
        try {
            const imageData = await ImageModel.findById(id);
            if (!imageData) return responseReturn(res, 404, { error: 'Image not found' });

            imageData.isActive = !imageData.isActive;
            await imageData.save();

            return responseReturn(res, 200, {
                image: imageData,
                message: `Image is now ${imageData.isActive ? 'active' : 'inactive'}`
            });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new ImageController();
