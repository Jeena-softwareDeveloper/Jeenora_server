const Farmer = require('../../models/Awareness/farmerModel');
const bcrypt = require('bcrypt');
const { createToken } = require('../../utiles/tokenCreate');
const { responseReturn } = require('../../utiles/response');

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
        try {
            const farmer = await Farmer.findOne({ email }).select('+password');
            if (!farmer) {
                return responseReturn(res, 401, { error: 'Invalid credentials' });
            }

            const match = await bcrypt.compare(password, farmer.password);
            if (!match) {
                return responseReturn(res, 401, { error: 'Invalid credentials' });
            }

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
            const updatedFarmer = await Farmer.findByIdAndUpdate(req.id, req.body, { new: true });
            return responseReturn(res, 200, { 
                user: updatedFarmer,
                message: 'Profile updated successfully' 
            });
        } catch (error) {
            return responseReturn(res, 500, { error: 'Internal Server Error' });
        }
    }
}

module.exports = new FarmerAuthController();
