const adminModel = require('../models/adminModel')
const sellerModel = require('../models/sellerModel')
const sellerCustomerModel = require('../models/chat/sellerCustomerModel')
const hireUserModel = require('../models/hire/hireUserModel')
const { responseReturn } = require('../utiles/response')
const bcrypt = require('bcrypt'); // Assurez-vous que bcrypt est bien importé
const { createToken } = require('../utiles/tokenCreate')
const formidable = require("formidable")
const cloudinary = require('cloudinary').v2
class authControllers {

    admin_login = async (req, res) => {
        const { email, password } = req.body
        try {
            const admin = await adminModel.findOne({ email }).select('+password')
            // console.log(admin)
            if (admin) {
                const match = await bcrypt.compare(password, admin.password)
                // console.log(match)
                if (match) {
                    const token = await createToken({
                        id: admin.id,
                        role: admin.role
                    })
                    res.cookie('accessToken', token, {
                        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                    })
                    responseReturn(res, 200, { token, message: "Login Success" })
                } else {
                    responseReturn(res, 404, { error: "Password Wrong" })
                }




            } else {
                responseReturn(res, 404, { error: "Email not Found" })
            }

        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }

    }

    seller_login = async (req, res) => {
        const { email, password } = req.body
        try {
            const seller = await sellerModel.findOne({ email }).select('+password')
            // console.log(admin)
            if (seller) {
                const match = await bcrypt.compare(password, seller.password)
                // console.log(match)
                if (match) {
                    const token = await createToken({
                        id: seller.id,
                        role: seller.role
                    })
                    res.cookie('accessToken', token, {
                        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                    })
                    responseReturn(res, 200, { token, message: "Login Success" })
                } else {
                    responseReturn(res, 404, { error: "Password Wrong" })
                }


            } else {
                responseReturn(res, 404, { error: "Email not Found" })
            }

        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }

    }


    seller_register = async (req, res) => {
        const { email, name, password } = req.body
        try {
            const getUser = await sellerModel.findOne({ email })
            if (getUser) {
                responseReturn(res, 404, { error: 'Email Already Exit' })
            } else {
                const seller = await sellerModel.create({
                    name,
                    email,
                    password: await bcrypt.hash(password, 10),
                    method: 'menualy',
                    shopInfo: {}
                })
                await sellerCustomerModel.create({
                    myId: seller.id
                })

                const token = await createToken({ id: seller.id, role: seller.role })
                res.cookie('accessToken', token, {
                    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                })

                responseReturn(res, 201, { token, message: 'Register Success' })
            }
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    hire_register = async (req, res) => {
        const { name, email, phone, password, skill, location, experience } = req.body;

        try {
            const existingUser = await hireUserModel.findOne({ email });
            if (existingUser) {
                return responseReturn(res, 400, { error: 'Email already exists' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const user = await hireUserModel.create({
                name,
                email,
                phone,
                skill: skill || null,
                location: location || null,
                experience: experience || null,
                password: hashedPassword,
            });

            const token = await createToken({
                id: user._id,
                role: user.role
            });

            res.cookie('accessToken', token, {
                expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                httpOnly: true
            });

            responseReturn(res, 201, {
                token,
                message: 'Hire user registered successfully',
                userInfo: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    skill: user.skill,
                    location: user.location,
                    experience: user.experience,
                    role: user.role
                }
            });

        } catch (error) {
            console.error(error);
            responseReturn(res, 500, { error: 'Internal server error' });
        }
    }

    hire_login = async (req, res) => {
        const { email, password } = req.body;

        try {
            const user = await hireUserModel.findOne({ email }).select('+password');
            if (!user) {
                return responseReturn(res, 404, { error: 'User not found' });
            }

            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                return responseReturn(res, 400, { error: 'Incorrect password' });
            }

            const token = await createToken({
                id: user._id,
                role: user.role
            });

            res.cookie('accessToken', token, {
                expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                httpOnly: true
            });

            responseReturn(res, 200, {
                token,
                message: 'Login successful',
                userInfo: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    skill: user.skill,
                    location: user.location,
                    experience: user.experience,
                    resumeUrl: user.resumeUrl,
                    subscription: user.subscription,
                    role: user.role
                }
            });

        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    getUser = async (req, res) => {
        const { id, role } = req;

        try {
            if (role === 'admin') {
                const user = await adminModel.findById(id)
                responseReturn(res, 200, { userInfo: user })
            } else if (role === 'seller') {
                const seller = await sellerModel.findById(id)
                responseReturn(res, 200, { userInfo: seller })
            } else if (role === 'hireUser') {
                const hireUser = await hireUserModel.findById(id)
                responseReturn(res, 200, { userInfo: hireUser })
            } else {
                responseReturn(res, 404, { error: 'User role not recognized' })
            }
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    profile_image_upload = async (req, res) => {
        const { id, role } = req

        try {
            // Safer formidable usage for v2/v3
            let form;
            if (typeof formidable === 'function') {
                form = formidable({ multiples: true });
            } else if (formidable.IncomingForm) {
                form = new formidable.IncomingForm({ multiples: true });
            } else {
                form = new formidable({ multiples: true });
            }

            form.parse(req, async (err, fields, files) => {
                if (err) {
                    console.error('Form parse error:', err)
                    return responseReturn(res, 500, { error: 'Image parsing failed: ' + err.message })
                }

                cloudinary.config({
                    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                    api_key: process.env.CLOUDINARY_API_KEY,
                    api_secret: process.env.CLOUDINARY_API_SECRET,
                    secure: true
                })

                if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
                    console.error('Cloudinary config missing in env variables');
                    return responseReturn(res, 500, { error: 'Server configuration error (Cloudinary)' });
                }

                // Debug logs
                console.log('Files received:', Object.keys(files));

                // Get image file - handle different formidable structures
                let imageFile = files.image;
                if (Array.isArray(imageFile)) {
                    imageFile = imageFile[0];
                }

                if (!imageFile) {
                    console.error('No image file found in files object')
                    return responseReturn(res, 400, { error: 'No image selected' })
                }

                if (!imageFile.filepath && !imageFile.path) {
                    console.error('Invalid file object (no path):', imageFile)
                    return responseReturn(res, 400, { error: 'Invalid file upload' })
                }

                const filePath = imageFile.filepath || imageFile.path;

                try {
                    console.log('Uploading image to Cloudinary from:', filePath)
                    const result = await cloudinary.uploader.upload(filePath, { folder: 'profile' })

                    if (result) {
                        console.log('Image uploaded successfully:', result.url)

                        if (role === 'seller') {
                            await sellerModel.findByIdAndUpdate(id, {
                                image: result.url
                            })
                            const userInfo = await sellerModel.findById(id)
                            responseReturn(res, 201, { message: 'Profile Image Upload Successfully', userInfo })
                        } else if (role === 'admin') {
                            await adminModel.findByIdAndUpdate(id, {
                                image: result.url
                            })
                            const userInfo = await adminModel.findById(id)
                            responseReturn(res, 201, { message: 'Profile Image Upload Successfully', userInfo })
                        } else if (role === 'hire' || role === 'hireUser') {
                            await hireUserModel.findByIdAndUpdate(id, {
                                image: result.url
                            })
                            const userInfo = await hireUserModel.findById(id)
                            responseReturn(res, 201, { message: 'Profile Image Upload Successfully', userInfo })
                        } else {
                            console.error('Invalid role:', role)
                            responseReturn(res, 400, { error: 'Invalid user role for image upload' })
                        }
                    } else {
                        responseReturn(res, 404, { error: 'Image Upload Failed' })
                    }
                } catch (error) {
                    console.error('Cloudinary upload error:', error)
                    responseReturn(res, 500, { error: 'Cloudinary error: ' + error.message })
                }
            })
        } catch (error) {
            console.error('Controller error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    profile_info_add = async (req, res) => {
        const { name, phone, address, shopName, division, district, sub_district } = req.body;
        const { id, role } = req;

        try {
            let userInfo;

            if (role === 'seller') {
                // Update seller info
                const seller = await sellerModel.findById(id);
                const updatedShopInfo = {
                    ...seller.shopInfo,
                    shopName: shopName || seller.shopInfo?.shopName,
                    division: division || seller.shopInfo?.division,
                    district: district || seller.shopInfo?.district,
                    sub_district: sub_district || seller.shopInfo?.sub_district,
                    address: address || seller.shopInfo?.address,
                    phone: phone || seller.shopInfo?.phone
                };

                await sellerModel.findByIdAndUpdate(id, {
                    name: name || seller.name,
                    shopInfo: updatedShopInfo
                });
                userInfo = await sellerModel.findById(id);
            } else if (role === 'admin') {
                // Update admin info
                await adminModel.findByIdAndUpdate(id, {
                    name: name,
                    // Admin might have different fields, adjust as needed
                });
                userInfo = await adminModel.findById(id);
            } else if (role === 'hire') {
                // Update hire user info
                await hireUserModel.findByIdAndUpdate(id, {
                    name: name,
                    phone: phone,
                    address: address
                });
                userInfo = await hireUserModel.findById(id);
            } else {
                return responseReturn(res, 400, { error: 'Invalid user role' });
            }

            responseReturn(res, 201, { message: 'Profile updated successfully', userInfo });
        } catch (error) {
            console.error('Profile update error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    hire_profile_info_update = async (req, res) => {
        const { skill, location, experience } = req.body;
        const { id } = req;

        try {
            await hireUserModel.findByIdAndUpdate(id, {
                skill,
                location,
                experience
            })
            const userInfo = await hireUserModel.findById(id)
            responseReturn(res, 201, { message: 'Profile info updated successfully', userInfo })
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }
    }

    logout = async (req, res) => {
        try {
            res.cookie('accessToken', null, {
                expires: new Date(Date.now()),
                httpOnly: true
            })
            responseReturn(res, 200, { message: 'logout Success' })
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }
    }

    admin_create_seller = async (req, res) => {
        const { email, name, password, permissions } = req.body
        try {
            const getUser = await sellerModel.findOne({ email })
            if (getUser) {
                responseReturn(res, 404, { error: 'Email Already Exit' })
            } else {
                const seller = await sellerModel.create({
                    name,
                    email,
                    password: await bcrypt.hash(password, 10),
                    method: 'menualy',
                    shopInfo: {},
                    status: 'active', // Admin created sellers are active by default
                    permissions: permissions || []
                })
                await sellerCustomerModel.create({
                    myId: seller.id
                })
                responseReturn(res, 201, { message: 'Seller Created Successfully', seller })
            }
        } catch (error) {
            console.log(error)
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    update_seller_permissions = async (req, res) => {
        const { sellerId, permissions } = req.body
        try {
            await sellerModel.findByIdAndUpdate(sellerId, {
                permissions
            })
            responseReturn(res, 200, { message: 'Permissions Updated Successfully' })
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }
    }

    update_seller_password = async (req, res) => {
        const { sellerId, password } = req.body
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            await sellerModel.findByIdAndUpdate(sellerId, {
                password: hashedPassword
            })
            responseReturn(res, 200, { message: 'Password Updated Successfully' })
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }
    }
}

module.exports = new authControllers()