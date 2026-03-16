const Pesticide = require('../../models/Awareness/pesticideModel');
const { responseReturn } = require('../../utiles/response');
const cloudinary = require('../../utiles/cloudinary');
const formidable = require('formidable');

class PesticideController {
    // Get all pesticides (for public)
    get_pesticides = async (req, res) => {
        try {
            const pesticides = await Pesticide.find({ isActive: true }).sort({ createdAt: -1 });
            return responseReturn(res, 200, { pesticides });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // Get all pesticides (for admin - all status)
    get_admin_pesticides = async (req, res) => {
        try {
            const pesticides = await Pesticide.find().sort({ createdAt: -1 });
            return responseReturn(res, 200, { pesticides });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    get_pesticide_detail = async (req, res) => {
        const { id } = req.params;
        try {
            const pesticide = await Pesticide.findById(id);
            if (!pesticide) return responseReturn(res, 404, { error: 'Pesticide not found' });
            return responseReturn(res, 200, { pesticide });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    add_pesticide = async (req, res) => {
        const form = formidable({ multiples: false });
        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 500, { error: err.message });

            const getValue = (val) => Array.isArray(val) ? val[0] : val;
            const name = getValue(fields.name);
            const category = getValue(fields.category);
            const description = getValue(fields.description);
            const effectiveness_rating = getValue(fields.effectiveness_rating);
            const safetyRating = getValue(fields.safetyRating);
            const application_type = getValue(fields.application_type);
            const usage_guide = getValue(fields.usage_guide);
            const { image } = files;

            if (!name || !category || !description) {
                return responseReturn(res, 400, { error: 'Required fields missing' });
            }

            try {
                let imageUrl = "";
                if (image) {
                    const result = await cloudinary.uploader.upload(image.filepath, { folder: 'Pesticides' });
                    imageUrl = result.secure_url;
                }

                const pesticide = await Pesticide.create({
                    name,
                    category,
                    description,
                    image: imageUrl,
                    effectiveness_rating: Number(effectiveness_rating) || 5,
                    safetyRating: safetyRating || "Safe",
                    application_type,
                    usage_guide,
                    isActive: true
                });

                return responseReturn(res, 201, { pesticide, message: 'Pesticide added successfully' });
            } catch (error) {
                return responseReturn(res, 500, { error: error.message });
            }
        });
    }

    update_pesticide = async (req, res) => {
        const { id } = req.params;
        const form = formidable({ multiples: false });
        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 500, { error: err.message });

            try {
                const pesticide = await Pesticide.findById(id);
                if (!pesticide) return responseReturn(res, 404, { error: 'Pesticide not found' });

                const getValue = (val) => Array.isArray(val) ? val[0] : val;
                
                if (fields.name) pesticide.name = getValue(fields.name);
                if (fields.category) pesticide.category = getValue(fields.category);
                if (fields.description) pesticide.description = getValue(fields.description);
                if (fields.effectiveness_rating) pesticide.effectiveness_rating = Number(getValue(fields.effectiveness_rating));
                if (fields.safetyRating) pesticide.safetyRating = getValue(fields.safetyRating);
                if (fields.application_type) pesticide.application_type = getValue(fields.application_type);
                if (fields.usage_guide) pesticide.usage_guide = getValue(fields.usage_guide);
                if (fields.isActive !== undefined) pesticide.isActive = getValue(fields.isActive) === 'true';

                if (files.image) {
                    const result = await cloudinary.uploader.upload(files.image.filepath, { folder: 'Pesticides' });
                    pesticide.image = result.secure_url;
                }

                await pesticide.save();
                return responseReturn(res, 200, { pesticide, message: 'Pesticide updated successfully' });
            } catch (error) {
                return responseReturn(res, 500, { error: error.message });
            }
        });
    }

    delete_pesticide = async (req, res) => {
        const { id } = req.params;
        try {
            await Pesticide.findByIdAndDelete(id);
            return responseReturn(res, 200, { message: 'Pesticide deleted' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    toggle_status = async (req, res) => {
        const { id } = req.params;
        try {
            const item = await Pesticide.findById(id);
            if (!item) return responseReturn(res, 404, { error: 'Not found' });
            item.isActive = !item.isActive;
            await item.save();
            return responseReturn(res, 200, { item, message: 'Status updated' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new PesticideController();
