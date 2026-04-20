const adminModel = require('../../models/adminModel')
const sellerModel = require('../../models/wear/sellerModel')
const sellerCustomerModel = require('../../models/chat/sellerCustomerModel')
const hireUserModel = require('../../models/hire/hireUserModel')
const OTP = require('../../models/hire/otpModel')
const { responseReturn } = require('../../utiles/response')
const bcrypt = require('bcrypt');
const { createToken } = require('../../utiles/tokenCreate')
const formidable = require("formidable")
const cloudinary = require('cloudinary').v2
const { generateOTP, sendOTPEmail } = require('../../services/emailService')
const { checkAccountLock, recordFailedLogin, clearFailedLogins, blacklistToken } = require('../../middlewares/authMiddleware');
class authControllers {

    admin_login = async (req, res) => {
        const { email, password } = req.body
        const ip = req.ip || req.connection.remoteAddress;
        try {
            // Check if account is locked
            const lockStatus = await checkAccountLock(email);
            if (lockStatus.locked) {
                return responseReturn(res, 429, {
                    error: `Account temporarily locked due to multiple failed attempts. Try again in ${lockStatus.remaining} minute(s).`
                });
            }

            const admin = await adminModel.findOne({ email }).select('+password')
            if (admin) {
                const match = await bcrypt.compare(password, admin.password)
                if (match) {
                    await clearFailedLogins(email); // Reset on success
                    const token = await createToken({ id: admin.id, role: admin.role })
                    res.cookie('accessToken', token, {
                        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'strict'
                    })
                    responseReturn(res, 200, { token, message: "Login Success" })
                } else {
                    await recordFailedLogin(email, ip);
                    responseReturn(res, 401, { error: "Invalid credentials" })
                }
            } else {
                responseReturn(res, 401, { error: "Invalid credentials" })
            }
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    seller_login = async (req, res) => {
        const { email, password } = req.body
        const ip = req.ip || req.connection.remoteAddress;
        try {
            // Check account lockout
            const lockStatus = await checkAccountLock(email);
            if (lockStatus.locked) {
                return responseReturn(res, 429, {
                    error: `Account temporarily locked. Try again in ${lockStatus.remaining} minute(s).`
                });
            }

            const seller = await sellerModel.findOne({ email }).select('+password')
            if (seller) {
                const match = await bcrypt.compare(password, seller.password)
                if (match) {
                    await clearFailedLogins(email);
                    const token = await createToken({ id: seller.id, role: seller.role })
                    res.cookie('accessToken', token, {
                        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'strict'
                    })
                    responseReturn(res, 200, { token, message: "Login Success" })
                } else {
                    await recordFailedLogin(email, ip);
                    responseReturn(res, 401, { error: "Invalid credentials" })
                }
            } else {
                responseReturn(res, 401, { error: "Invalid credentials" })
            }
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' })
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
                    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict'
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

            // Verify if OTP was verified for this email
            const otpRecord = await OTP.findOne({
                email,
                purpose: 'signup',
                verified: true
            }).sort({ createdAt: -1 });

            if (!otpRecord) {
                return responseReturn(res, 400, { error: 'Please verify your email with OTP first' });
            }

            // Optional: Check if OTP is too old (e.g. verified > 10 mins ago)
            if (Date.now() - new Date(otpRecord.updatedAt).getTime() > 10 * 60 * 1000) { // 10 minutes
                return responseReturn(res, 400, { error: 'OTP verification expired. Please verify again.' });
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
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
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
        const ip = req.ip || req.connection.remoteAddress;

        try {
            // Check account lockout
            const lockStatus = await checkAccountLock(email);
            if (lockStatus.locked) {
                return responseReturn(res, 429, {
                    error: `Account temporarily locked. Try again in ${lockStatus.remaining} minute(s).`
                });
            }

            const user = await hireUserModel.findOne({ email }).select('+password');
            if (!user) {
                return responseReturn(res, 401, { error: 'Invalid credentials' });
            }

            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                await recordFailedLogin(email, ip);
                return responseReturn(res, 401, { error: 'Invalid credentials' });
            }

            await clearFailedLogins(email);
            const token = await createToken({ id: user._id, role: user.role });

            res.cookie('accessToken', token, {
                expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
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
            responseReturn(res, 500, { error: 'Internal server error' });
        }
    }

    getUser = async (req, res) => {
        const { id, role } = req;

        try {
            let user;
            if (role === 'admin') {
                user = await adminModel.findById(id);
            } else if (role === 'seller') {
                user = await sellerModel.findById(id);
            } else if (role === 'hireUser') {
                user = await hireUserModel.findById(id);
            }

            if (!user) {
                return responseReturn(res, 404, { error: 'User not found' });
            }

            responseReturn(res, 200, { userInfo: user });
        } catch (error) {
            console.error('getUser Error:', error);
            responseReturn(res, 500, { error: 'Internal Server Error' });
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
            // Blacklist the current token so it can never be reused
            if (req.token) {
                await blacklistToken(req.token);
            }
            res.cookie('accessToken', null, {
                expires: new Date(Date.now()),
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            })
            responseReturn(res, 200, { message: 'Logout successful' })
        } catch (error) {
            responseReturn(res, 500, { error: 'Logout failed' })
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

    // New API Methods for Mobile App
    send_otp = async (req, res) => {
        const { phone } = req.body;
        if (!phone) return responseReturn(res, 400, { error: 'Phone number is required' });

        try {
            const otpCode = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digit OTP

            // Upsert OTP record
            await OTP.findOneAndUpdate(
                { phone, purpose: 'login' },
                {
                    otp: otpCode,
                    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
                    verified: false
                },
                { upsert: true, new: true }
            );

            const { sendSMS } = require('../../services/smsService');
            await sendSMS(phone, otpCode);

            responseReturn(res, 200, { message: 'OTP sent successfully', success: true });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    verify_otp = async (req, res) => {
        const { phone, otp, deviceId } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        if (!phone || !otp) return responseReturn(res, 400, { error: 'Phone and OTP are required' });

        try {
            const otpRecord = await OTP.findOne({ phone, otp, purpose: 'login' });

            if (!otpRecord || otpRecord.expiresAt < new Date()) {
                return responseReturn(res, 400, { error: 'Invalid or expired OTP' });
            }

            // Mark verified
            otpRecord.verified = true;
            await otpRecord.save();

            // Find or create customer
            let customer = await require('../../models/wear/customerModel').findOne({ phone });
            let userType = 'Existing';

            if (!customer) {
                userType = 'New';
                customer = await require('../../models/wear/customerModel').create({
                    name: 'Guest',
                    phone,
                    email: `user_${Date.now()}@jeenora.com`,
                    password: await bcrypt.hash(Math.random().toString(36), 10),
                    method: 'mobile'
                });
            }

            // Handle Device Registration
            if (deviceId) {
                const deviceIndex = customer.devices ? customer.devices.findIndex(d => d.deviceId === deviceId) : -1;
                if (deviceIndex > -1) {
                    customer.devices[deviceIndex].ip = ip;
                    customer.devices[deviceIndex].lastLogin = new Date();
                    customer.devices[deviceIndex].userAgent = userAgent;
                } else {
                    if (!customer.devices) customer.devices = [];
                    customer.devices.push({ deviceId, ip, userAgent, lastLogin: new Date() });
                }
                await customer.save();
            }

            const token = await createToken({
                id: customer._id,
                role: 'user',
                deviceId: deviceId
            });

            responseReturn(res, 200, {
                token,
                userType,
                userInfo: customer,
                message: 'Verification successful'
            });

        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    update_onboarding = async (req, res) => {
        const { language, gender, ageGroup } = req.body;
        const { id } = req;

        try {
            const customer = await require('../../models/wear/customerModel').findByIdAndUpdate(id, {
                onboarding: { language, gender, ageGroup }
            }, { new: true });

            if (!customer) return responseReturn(res, 404, { error: 'User not found' });

            responseReturn(res, 200, {
                message: 'Onboarding updated successfully',
                userInfo: customer
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new authControllers()
