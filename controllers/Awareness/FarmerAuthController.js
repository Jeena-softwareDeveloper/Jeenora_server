const Farmer = require('../../models/Awareness/farmerModel');
const bcrypt = require('bcrypt');
const { createToken } = require('../../utiles/tokenCreate');
const { responseReturn } = require('../../utiles/response');
const formidable = require('formidable');
const cloudinary = require('cloudinary').v2;
const { checkAccountLock, recordFailedLogin, clearFailedLogins } = require('../../middlewares/authMiddleware');

class FarmerAuthController {
    
    // Register Farmer
    register = async (req, res) => {
        const { name, email, password, district, crops } = req.body;
        try {
            const existingFarmer = await Farmer.findOne({ email });
            if (existingFarmer) {
                return responseReturn(res, 400, { error: 'Email already exists' });
            }

            const farmer = await Farmer.create({
                name,
                email,
                password: await bcrypt.hash(password, 10),
                district,
                crops: Array.isArray(crops) ? crops : [crops]
            });

            const token = await createToken({ id: farmer.id, role: farmer.role });
            
            return responseReturn(res, 201, { 
                token, 
                user: farmer,
                message: 'Registration successful' 
            });
        } catch (error) {
            console.error('Farmer Register Error:', error);
            return responseReturn(res, 500, { error: 'Internal Server Error' });
        }
    }

    // Login Farmer
    login = async (req, res) => {
        const { email, password } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        try {
            // Check account lockout
            const lockStatus = await checkAccountLock(email);
            if (lockStatus.locked) {
                return responseReturn(res, 429, {
                    error: `Account temporarily locked due to multiple failed attempts. Try again in ${lockStatus.remaining} minute(s).`
                });
            }

            const farmer = await Farmer.findOne({ email }).select('+password');
            if (!farmer) {
                await recordFailedLogin(email, ip);
                return responseReturn(res, 401, { error: 'Invalid credentials' });
            }

            const match = await bcrypt.compare(password, farmer.password);
            if (!match) {
                await recordFailedLogin(email, ip);
                return responseReturn(res, 401, { error: 'Invalid credentials' });
            }

            // Clear failed login attempts on success
            await clearFailedLogins(email);

            const token = await createToken({ id: farmer.id, role: farmer.role });
            
            // Remove password from object
            const farmerObj = farmer.toObject();
            delete farmerObj.password;

            return responseReturn(res, 200, { 
                token, 
                user: farmerObj,
                message: 'Login successful' 
            });
        } catch (error) {
            console.error('Farmer Login Error:', error);
            return responseReturn(res, 500, { error: 'Internal Server Error' });
        }
    }

    // Get Farmer Profile
    get_profile = async (req, res) => {
        try {
            const farmer = await Farmer.findById(req.id);
            if (!farmer) {
                return responseReturn(res, 404, { error: 'Farmer not found' });
            }
            return responseReturn(res, 200, { user: farmer });
        } catch (error) {
            return responseReturn(res, 500, { error: 'Internal Server Error' });
        }
    }

    // Update Farmer Profile
    update_profile = async (req, res) => {
        try {
            const farmer = await Farmer.findById(req.id);
            if (!farmer) {
                return responseReturn(res, 404, { error: 'Farmer not found' });
            }

            const updates = req.body;
            
            // Calculate profile completion percentage
            const fieldsToCheck = ['name', 'email', 'district', 'crops', 'language'];
            let filled = 0;
            fieldsToCheck.forEach(f => {
                const val = updates[f] !== undefined ? updates[f] : farmer[f];
                if (val && (Array.isArray(val) ? val.length > 0 : val !== '')) {
                    filled++;
                }
            });
            updates.profileCompletion = (filled / fieldsToCheck.length) * 100;

            // Update Impact Score (Overall Stability) based on activity and points
            const postsCount = updates.postsCount !== undefined ? updates.postsCount : farmer.postsCount;
            const points = updates.points !== undefined ? updates.points : farmer.points;
            
            const activityScore = Math.min((postsCount || 0) * 5, 10); // max 10
            const pointsScore = Math.min((points || 0) / 250, 5); // max 5
            updates.impactCore = Math.min(84 + activityScore + pointsScore, 99.9);

            const updatedFarmer = await Farmer.findByIdAndUpdate(req.id, updates, { new: true });
            
            return responseReturn(res, 200, { 
                user: updatedFarmer,
                message: 'Profile updated successfully' 
            });
        } catch (error) {
            console.error('Update Profile Error:', error);
            return responseReturn(res, 500, { error: 'Internal Server Error' });
        }
    }

    // Update Profile Image
    profile_image_upload = async (req, res) => {
        const { id } = req;
        const form = formidable({ multiples: true });

        form.parse(req, async (err, fields, files) => {
            if (err) {
                return responseReturn(res, 500, { error: err.message });
            }

            const { image } = files;
            const imageFile = Array.isArray(image) ? image[0] : image;

            cloudinary.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET,
                secure: true
            });

            try {
                if (!imageFile) {
                    return responseReturn(res, 400, { error: 'No image provided' });
                }

                const result = await cloudinary.uploader.upload(imageFile.filepath, { folder: 'farmer_profiles' });

                if (result) {
                    const farmer = await Farmer.findByIdAndUpdate(id, {
                        image: result.url
                    }, { new: true });

                    responseReturn(res, 200, {
                        success: true,
                        message: 'Profile image updated successfully',
                        image: result.url,
                        user: farmer
                    });
                } else {
                    responseReturn(res, 500, { error: 'Image upload failed' });
                }
            } catch (error) {
                console.error('Image Upload Error:', error);
                responseReturn(res, 500, { error: error.message });
            }
        });
    }
}

module.exports = new FarmerAuthController();
