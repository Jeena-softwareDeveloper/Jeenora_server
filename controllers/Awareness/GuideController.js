const cloudinary = require('../../utiles/cloudinary');
const formidable = require('formidable');
const { responseReturn } = require('../../utiles/response');
const Guide = require('../../models/Awareness/guideModel');
const GuideCategory = require('../../models/Awareness/guideCategoryModel');

class GuideController {

    // ------------------ CATEGORY CRUD ------------------

    // Add Category
    add_category = async (req, res) => {
        try {
            const { name } = req.body;
            if (!name) return responseReturn(res, 400, { error: 'Category name is required' });

            const slug = name.split(' ').join('-');

            const category = await GuideCategory.create({ name, slug });
            return responseReturn(res, 201, { category, message: 'Category created successfully' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // Get all categories
    get_categories = async (req, res) => {
        try {
            const categories = await GuideCategory.find().sort({ createdAt: -1 });
            return responseReturn(res, 200, { categories });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // Delete Category
    delete_category = async (req, res) => {
        try {
            const category = await GuideCategory.findByIdAndDelete(req.params.id);
            if (!category) return responseReturn(res, 404, { error: 'Category not found' });
            return responseReturn(res, 200, { message: 'Category deleted successfully' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // ------------------ GUIDE CRUD ------------------

    // Add Guide
    add_guide = async (req, res) => {
        const form = formidable({ multiples: false });
        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 500, { error: 'Something went wrong' });

            const { categoryId, heading, level, secondHeading, description } = fields;
            const { image } = files;

            if (!categoryId || !heading || !level || !description) {
                return responseReturn(res, 400, { error: 'Category, heading, level, and description are required' });
            }

            try {
                const slug = heading.split(' ').join('-');

                let imageUrl = '';
                if (image) {
                    const result = await cloudinary.uploader.upload(image.filepath, { folder: 'Guides' });
                    imageUrl = result.secure_url;
                }

                const guide = await Guide.create({
                    category: categoryId,
                    heading,
                    slug,
                    level,
                    secondHeading,
                    description,
                    image: imageUrl,
                    isActive: true // default active
                });

                return responseReturn(res, 201, { guide, message: 'Guide created successfully' });
            } catch (error) {
                return responseReturn(res, 500, { error: error.message });
            }
        });
    }

    // Get all guides
    get_guides = async (req, res) => {
        try {
            let guides = await Guide.find().populate('category').sort({ createdAt: -1 });
            guides = guides.map(g => {
                const guideObj = g.toObject();
                if (guideObj.image && guideObj.image.includes("http://")) {
                    guideObj.image = guideObj.image.replace("http://", "https://");
                }
                return guideObj;
            });
            return responseReturn(res, 200, { guides });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // Get guides by category
    get_guides_by_category = async (req, res) => {
        try {
            const { categoryId } = req.params;
            let guides = await Guide.find({ category: categoryId }).populate('category');
            guides = guides.map(g => {
                const guideObj = g.toObject();
                if (guideObj.image && guideObj.image.includes("http://")) {
                    guideObj.image = guideObj.image.replace("http://", "https://");
                }
                return guideObj;
            });
            return responseReturn(res, 200, { guides });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // Update guide
    update_guide = async (req, res) => {
        const form = formidable({ multiples: false });
        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 500, { error: 'Something went wrong' });

            const { heading, level, secondHeading, description, categoryId, isActive } = fields;
            const { image } = files;

            try {
                const guide = await Guide.findById(req.params.id);
                if (!guide) return responseReturn(res, 404, { error: 'Guide not found' });

                if (heading) {
                    guide.heading = heading;
                    guide.slug = heading.split(' ').join('-');
                }
                if (level) guide.level = level;
                if (secondHeading) guide.secondHeading = secondHeading;
                if (description) guide.description = description;
                if (categoryId) guide.category = categoryId;
                if (typeof isActive !== 'undefined') guide.isActive = isActive === 'true';

                if (image) {
                    const result = await cloudinary.uploader.upload(image.filepath, { folder: 'Guides' });
                    guide.image = result.secure_url;
                }

                await guide.save();
                return responseReturn(res, 200, { guide, message: 'Guide updated successfully' });
            } catch (error) {
                return responseReturn(res, 500, { error: error.message });
            }
        });
    }

    // Delete guide
    delete_guide = async (req, res) => {
        try {
            const guide = await Guide.findByIdAndDelete(req.params.id);
            if (!guide) return responseReturn(res, 404, { error: 'Guide not found' });
            return responseReturn(res, 200, { message: 'Guide deleted successfully' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // Toggle guide status
    toggle_status = async (req, res) => {
        try {
            const guide = await Guide.findById(req.params.id);
            if (!guide) return responseReturn(res, 404, { error: 'Guide not found' });

            guide.isActive = !guide.isActive;
            await guide.save();

            return responseReturn(res, 200, { guide, message: `Guide is now ${guide.isActive ? 'Active' : 'Inactive'}` });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

}

module.exports = new GuideController();
