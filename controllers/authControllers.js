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
        const form = formidable({ multiples: true })
        form.parse(req, async (err, _, files) => {
            cloudinary.config({
                cloud_name: process.env.cloud_name,
                api_key: process.env.api_key,
                api_secret: process.env.api_secret,
                secure: true
            })
            const { image } = files

            try {
                const result = await cloudinary.uploader.upload(image.filepath, { folder: 'profile' })
                if (result) {
                    if (role === 'seller') {
                        await sellerModel.findByIdAndUpdate(id, {
                            image: result.url
                        })
                        const userInfo = await sellerModel.findById(id)
                        responseReturn(res, 201, { message: 'Profile Image Upload Successfully', userInfo })
                    } else if (role === 'hireUser') {
                        await hireUserModel.findByIdAndUpdate(id, {
                            image: result.url
                        })
                        const userInfo = await hireUserModel.findById(id)
                        responseReturn(res, 201, { message: 'Profile Image Upload Successfully', userInfo })
                    } else {
                        responseReturn(res, 400, { error: 'Invalid user role for image upload' })
                    }
                } else {
                    responseReturn(res, 404, { error: 'Image Upload Failed' })
                }
            } catch (error) {
                responseReturn(res, 500, { error: error.message })
            }
        })
    }

    profile_info_add = async (req, res) => {
        const { division, district, shopName, sub_district } = req.body;
        const { id } = req;

        try {
            await sellerModel.findByIdAndUpdate(id, {
                shopInfo: {
                    shopName,
                    division,
                    district,
                    sub_district
                }
            })
            const userInfo = await sellerModel.findById(id)
            responseReturn(res, 201, { message: 'Profile info Add Successfully', userInfo })
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
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
}

module.exports = new authControllers()