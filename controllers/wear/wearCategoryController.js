const formidable = require("formidable");
const { responseReturn } = require("../../utiles/response");
const cloudinary = require('cloudinary').v2;
const wearCategoryModel = require('../../models/wear/wearCategoryModel');

class WearCategoryController {

    add_category = async (req, res) => {
        const form = formidable();
        form.parse(req, async (err, fields, files) => {
            if (err) {
                responseReturn(res, 404, { error: 'Something went wrong' });
            } else {
                let { name, additionalDetails, priority } = fields;
                let { image } = files;

                if (!name || (Array.isArray(name) && !name[0])) {
                    return responseReturn(res, 400, { error: 'Category name is required' });
                }

                if (!image || (Array.isArray(image) && !image[0])) {
                    return responseReturn(res, 400, { error: 'Category image is required' });
                }

                // Handle formidable v3+ returns arrays for fields
                name = Array.isArray(name) ? name[0] : name;
                let status = fields.status;
                status = Array.isArray(status) ? status[0] : status;
                image = Array.isArray(image) ? image[0] : image;
                additionalDetails = Array.isArray(additionalDetails) ? additionalDetails[0] : additionalDetails;

                const getRawField = (field) => Array.isArray(field) ? field[0] : field;

                const safeParse = (value) => {
                    if (!value || value === 'undefined' || value === 'null') return null;
                    if (typeof value === 'object') return value;
                    try {
                        return JSON.parse(value);
                    } catch (e) {
                        console.error("JSON Parse Error:", e, "Value:", value);
                        return null;
                    }
                };

                let parsedAdditionalDetails = safeParse(getRawField(additionalDetails)) || [];

                let parentId = fields.parentId;
                parentId = Array.isArray(parentId) ? parentId[0] : parentId;

                if (parentId === 'null' || !parentId || parentId === '') {
                    parentId = null;
                }

                let level = 0;
                if (parentId && parentId !== 'null') {
                    const parentCategory = await wearCategoryModel.findById(parentId);
                    if (parentCategory) {
                        level = (parentCategory.level || 0) + 1;
                    } else {
                        parentId = null; // Parent not found, reset to Root
                    }
                }

                name = name.trim();
                let slug = name.toLowerCase().split(' ').join('-');

                if (parentId) {
                    const parent = await wearCategoryModel.findById(parentId);
                    if (parent) {
                        slug = `${parent.slug}-${slug}`;
                    }
                }

                cloudinary.config({
                    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                    api_key: process.env.CLOUDINARY_API_KEY,
                    api_secret: process.env.CLOUDINARY_API_SECRET,
                    secure: true
                });

                try {
                    const removeBackground = fields.removeBackground === 'true' || fields.removeBackground === true;

                    const uploadOptions = {
                        folder: 'wear_categories',
                        resource_type: 'image'
                    };

                    if (removeBackground) {
                        uploadOptions.background_removal = "cloudinary_ai";
                        uploadOptions.format = 'png'; // Ensure transparency
                    }

                    const result = await cloudinary.uploader.upload(image.filepath, uploadOptions);

                    if (result && result.secure_url) {
                        const existingPriority = await wearCategoryModel.findOne({ priority: parseInt(priority), parentId: parentId });
                        if (existingPriority) {
                            return responseReturn(res, 400, { error: `Priority ${priority} is already assigned to category: ${existingPriority.name}` });
                        }

                        const category = await wearCategoryModel.create({
                            name,
                            slug,
                            status: status || 'active',
                            image: result.secure_url,
                            parentId: parentId,
                            level: level,
                            additionalDetails: parsedAdditionalDetails,
                            priority: parseInt(priority) || 0
                        });
                        responseReturn(res, 201, { category, message: 'Wear Category Added Successfully' });
                    } else {
                        throw new Error('Cloudinary did not return a secure URL');
                    }
                } catch (error) {
                    console.error('❌ Add Wear Category Error:', error.message);
                    responseReturn(res, 500, { error: `Upload Failed: ${error.message}` });
                }

            }
        });
    }

    get_categories = async (req, res) => {
        const { page, searchValue, parPage } = req.query;

        try {
            let skipPage = '';
            if (parPage && page) {
                skipPage = parseInt(parPage) * (parseInt(page) - 1);
            }

            let query = {};
            if (searchValue) {
                query = { $text: { $search: searchValue } };
            }

            const { parentId, level, _id } = req.query;
            if (parentId) query.parentId = parentId;
            if (_id) query._id = _id;
            if (level !== undefined) query.level = parseInt(level);

            if (parPage && page) {
                const categories = await wearCategoryModel.find(query)
                    .sort({ priority: 1, createdAt: -1 })
                    .skip(skipPage)
                    .limit(parseInt(parPage));
                const totalCategories = await wearCategoryModel.countDocuments(query);
                responseReturn(res, 200, { categories, totalCategories });
            } else {
                const categories = await wearCategoryModel.find(query).sort({ priority: 1, createdAt: -1 });
                const totalCategories = await wearCategoryModel.countDocuments(query);
                responseReturn(res, 200, { categories, totalCategories });
            }
        } catch (error) {
            console.error('Get Wear Categories Error:', error);
            responseReturn(res, 500, { error: 'Internal Server Error' });
        }
    }

    update_category = async (req, res) => {
        const form = formidable();
        form.parse(req, async (err, fields, files) => {
            if (err) {
                responseReturn(res, 404, { error: 'Something went wrong' });
            } else {
                const { id } = req.params;
                let { name, status, additionalDetails, priority } = fields;
                let { image } = files;

                // Handle formidable v3+ arrays
                name = Array.isArray(name) ? name[0] : name;
                status = Array.isArray(status) ? status[0] : status;
                image = Array.isArray(image) ? image[0] : image;
                try {
                    let parentId = fields.parentId;
                    parentId = Array.isArray(parentId) ? parentId[0] : parentId;

                    if (parentId === 'null' || !parentId || parentId === '') {
                        parentId = null;
                    }

                    let parsedAdditionalDetails = null;

                    // Robust parsing for formidable v3+ which might return fields as strings or arrays of strings
                    const getRawField = (field) => Array.isArray(field) ? field[0] : field;

                    const safeParse = (value) => {
                        if (!value || value === 'undefined' || value === 'null') return null;
                        if (typeof value === 'object') return value;
                        try {
                            return JSON.parse(value);
                        } catch (e) {
                            console.error("JSON Parse Error:", e, "Value:", value);
                            return null;
                        }
                    };

                    if (additionalDetails !== undefined) {
                        parsedAdditionalDetails = safeParse(getRawField(additionalDetails));
                    }

                    if (parentId === id) {
                        return responseReturn(res, 400, { error: 'Category cannot be its own parent' });
                    }

                    let level = 0;
                    if (parentId && parentId !== 'null') {
                        // Circularity check: Ensure parentId is not a descendant of current category
                        const isDescendant = async (parent, targetId) => {
                            const children = await wearCategoryModel.find({ parentId: parent });
                            for (const child of children) {
                                if (child._id.toString() === targetId) return true;
                                if (await isDescendant(child._id, targetId)) return true;
                            }
                            return false;
                        };

                        if (await isDescendant(id, parentId)) {
                            return responseReturn(res, 400, { error: 'Circular dependency detected: Cannot set a child as parent' });
                        }

                        const parentCategory = await wearCategoryModel.findById(parentId);
                        if (parentCategory) {
                            level = (parentCategory.level || 0) + 1;
                        } else {
                            parentId = null;
                        }
                    }

                    let updateData = {};
                    if (name) {
                        const trimmedName = name.trim();
                        let slug = trimmedName.toLowerCase().split(' ').join('-');
                        if (parentId) {
                            const parent = await wearCategoryModel.findById(parentId);
                            if (parent) {
                                slug = `${parent.slug}-${slug}`;
                            }
                        }
                        updateData.name = trimmedName;
                        updateData.slug = slug;
                    }
                    if (status) updateData.status = status;
                    updateData.parentId = parentId;
                    updateData.level = level;
                    if (parsedAdditionalDetails !== null) updateData.additionalDetails = parsedAdditionalDetails;
                    if (priority !== undefined && priority !== null) {
                        const pVal = Array.isArray(priority) ? priority[0] : priority;
                        if (pVal !== "" && pVal !== "null") {
                            const parsedPriority = parseInt(pVal);
                            const existingPriority = await wearCategoryModel.findOne({ 
                                priority: parsedPriority, 
                                parentId: parentId,
                                _id: { $ne: id } 
                            });
                            if (existingPriority) {
                                return responseReturn(res, 400, { error: `Priority ${parsedPriority} is already assigned to category: ${existingPriority.name}` });
                            }
                            updateData.priority = parsedPriority;
                        }
                    }

                    if (image) {
                        cloudinary.config({
                            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                            api_key: process.env.CLOUDINARY_API_KEY,
                            api_secret: process.env.CLOUDINARY_API_SECRET,
                            secure: true
                        });

                        const removeBackground = fields.removeBackground === 'true' || fields.removeBackground === true;
                        const uploadOptions = { folder: 'wear_categories' };

                        if (removeBackground) {
                            uploadOptions.background_removal = "cloudinary_ai";
                            uploadOptions.format = 'png';
                        }

                        const result = await cloudinary.uploader.upload(image.filepath, uploadOptions);
                        if (result && result.secure_url) {
                            updateData.image = result.secure_url;
                        } else {
                            throw new Error('Cloudinary upload failed or returned no secure URL');
                        }
                    }


                    const category = await wearCategoryModel.findByIdAndUpdate(id, updateData, { new: true });
                    if (!category) {
                        return responseReturn(res, 404, { error: 'Category not found' });
                    }
                    responseReturn(res, 200, { category, message: 'Wear Category Updated Successfully' });
                } catch (error) {
                    console.error('Update Wear Category Error:', error);
                    responseReturn(res, 500, { error: 'Internal Server Error' });
                }
            }
        });
    }

    delete_category = async (req, res) => {
        try {
            const { id } = req.params;
            const category = await wearCategoryModel.findByIdAndDelete(id);
            if (!category) {
                return responseReturn(res, 404, { error: 'Category not found' });
            }
            responseReturn(res, 200, { message: 'Wear Category Deleted Successfully' });
        } catch (error) {
            console.error('Delete Wear Category Error:', error);
            responseReturn(res, 500, { error: 'Internal Server Error' });
        }
    }

    get_pure_categories = async (req, res) => {
        const { parentId, level } = req.query;

        try {
            let query = { status: 'active' };
            if (parentId) {
                query.parentId = parentId === 'null' ? null : parentId;
            } else if (level !== undefined) {
                query.level = parseInt(level);
            }

            const categories = await wearCategoryModel.find(query)
                .select('_id name image level parentId additionalDetails')
                .sort({ priority: 1, createdAt: -1 })
                .lean();

            // Function to recursively get inherited details
            const getInheritedDetails = async (catId, currentDetails = []) => {
                const cat = await wearCategoryModel.findById(catId).select('parentId additionalDetails').lean();
                if (!cat) return currentDetails;
                
                let merged = [...currentDetails, ...(cat.additionalDetails || [])];
                
                // Remove duplicates by name (keep the deepest level's version)
                const unique = [];
                const seen = new Set();
                merged.forEach(d => {
                    if (!seen.has(d.name)) {
                        seen.add(d.name);
                        unique.push(d);
                    }
                });

                if (cat.parentId) {
                    return await getInheritedDetails(cat.parentId, unique);
                }
                return unique;
            };

            // Add subCount and inheritedDetails to each category
            const categoriesWithExtras = await Promise.all(
                categories.map(async (cat) => {
                    const subCount = await wearCategoryModel.countDocuments({ parentId: cat._id, status: 'active' });
                    
                    // If it's a leaf node (subCount === 0), it's crucial to have all inherited specs for the supplier
                    let finalDetails = cat.additionalDetails || [];
                    if (subCount === 0) {
                        finalDetails = await getInheritedDetails(cat._id);
                    }

                    return {
                        ...cat,
                        additionalDetails: finalDetails,
                        subCount
                    };
                })
            );

            responseReturn(res, 200, { categories: categoriesWithExtras });
        } catch (error) {
            console.error('Get Pure Wear Categories Error:', error);
            responseReturn(res, 500, { error: 'Internal Server Error' });
        }
    }
}

module.exports = new WearCategoryController();
