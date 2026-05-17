const adminModel = require('../../models/superadmin/adminModel')
const partnerModel = require('../../models/partner/Partner')
const partnerCustomerModel = require('../../models/chat/partnerCustomerModel')
const OTP = require('../../models/admin/WearOtp')
const { responseReturn } = require('../../utils/response')
const bcrypt = require('bcrypt');
const { createToken } = require('../../utils/tokenCreate')
const formidable = require("formidable")
const cloudinary = require('cloudinary').v2
const { checkAccountLock, recordFailedLogin, clearFailedLogins, blacklistToken } = require('../../middlewares/authMiddleware');

class authControllers {

    admin_login = async (req, res) => {
        const { email, password } = req.body
        const ip = req.ip || req.connection.remoteAddress;
        try {
            const lockStatus = await checkAccountLock(email);
            if (lockStatus.locked) {
                return responseReturn(res, 429, {
                    error: `Account temporarily locked due to multiple failed attempts. Try again in ${lockStatus.remaining} minute(s).`
                });
            }

            let isInternal = true;
            let admin = await adminModel.findOne({ email }).select('+password');
            let isSuper = false;

            if (admin) {
                isSuper = admin.role === 'superadmin';
            } else {
                isInternal = false;
                admin = await partnerModel.findOne({ email }).select('+password');
            }

            if (admin) {
                if (admin.status === 'inactive') {
                    return responseReturn(res, 403, { error: "Account deactivated. Contact Super Administrator." })
                }
                const match = await bcrypt.compare(password, admin.password)
                if (match) {
                    await clearFailedLogins(email);
                    const tokenRole = isSuper ? 'superadmin' : 'admin';
                    const userType = isInternal ? (isSuper ? 'superadmin' : 'subadmin') : 'merchant';
                    const token = await createToken({ id: admin.id, role: tokenRole, userType, permissions: admin.permissions || [] })
                    res.cookie('accessToken', token, {
                        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'strict'
                    })
                    const userInfoObj = { ...admin.toObject(), userType };
                    delete userInfoObj.password;
                    responseReturn(res, 200, { token, userType, userInfo: userInfoObj, message: `Welcome ${admin.name} (${isSuper ? 'Super Admin' : (isInternal ? 'Manager' : 'Merchant')})` })
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

    create_sub_admin = async (req, res) => {
        const { email, name, password, image, permissions } = req.body
        try {
            if (!email || !name || !password) {
                return responseReturn(res, 400, { error: 'Name, Email, and Password are required' })
            }
            const existingAdmin = await adminModel.findOne({ email })
            if (existingAdmin) {
                return responseReturn(res, 404, { error: 'Admin Email Already Exists' })
            }
            const newAdmin = await adminModel.create({
                name,
                email,
                password: await bcrypt.hash(password, 10),
                image: image || 'https://res.cloudinary.com/dpvjtswbe/image/upload/v1711516223/profile/admin_avatar.png',
                role: 'admin',
                permissions: permissions || []
            });
            responseReturn(res, 201, { message: 'Sub-Administrator Created Successfully', admin: newAdmin })
        } catch (error) {
            console.error(error);
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    get_all_admins = async (req, res) => {
        try {
            const admins = await adminModel.find({ role: { $ne: 'superadmin' } }).sort({ createdAt: -1 });
            responseReturn(res, 200, { admins, totalAdmin: admins.length });
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal Server Error' });
        }
    }

    update_sub_admin_status = async (req, res) => {
        const { adminId, status } = req.body;
        try {
            await adminModel.findByIdAndUpdate(adminId, { status });
            responseReturn(res, 200, { message: `Sub-Admin status updated to ${status}` });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    update_sub_admin_permissions = async (req, res) => {
        const { adminId, permissions } = req.body;
        try {
            await adminModel.findByIdAndUpdate(adminId, { permissions });
            responseReturn(res, 200, { message: 'Sub-Admin permissions updated successfully' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    update_sub_admin_password = async (req, res) => {
        const { adminId, password } = req.body;
        try {
            if (!password || password.length < 6) {
                return responseReturn(res, 400, { error: 'Password must be at least 6 characters long' });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            await adminModel.findByIdAndUpdate(adminId, { password: hashedPassword });
            responseReturn(res, 200, { message: 'Sub-Admin password updated successfully' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    partner_login = async (req, res) => {
        return this.admin_login(req, res);
    }

    partner_register = async (req, res) => {
        const { email, name, password, phoneNumber } = req.body
        try {
            if (!email || !name || !password || !phoneNumber) {
                return responseReturn(res, 400, { error: 'Name, Email, Password and Phone are required' })
            }

            const getUser = await partnerModel.findOne({ $or: [{ email }, { phoneNumber }] })
            if (getUser) {
                responseReturn(res, 404, { error: 'Email or Phone Number Already Exists' })
            } else {
                const partner = await partnerModel.create({
                    name,
                    email,
                    phoneNumber,
                    password: await bcrypt.hash(password, 10),
                    method: 'menualy',
                    shopInfo: {}
                })
                await partnerCustomerModel.create({ myId: partner.id })

                const token = await createToken({ id: partner.id, role: partner.role })
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

    getUser = async (req, res) => {
        const { id } = req;

        try {
            let isInternal = true;
            let user = await adminModel.findById(id);
            if (!user) {
                isInternal = false;
                user = await partnerModel.findById(id);
            }

            if (!user) {
                return responseReturn(res, 404, { error: 'User not found' });
            }

            const userType = isInternal ? (user.role === 'superadmin' ? 'superadmin' : 'subadmin') : 'merchant';
            const userInfoObj = { ...user.toObject(), userType };
            delete userInfoObj.password;

            responseReturn(res, 200, { userInfo: userInfoObj });
        } catch (error) {
            console.error('getUser Error:', error);
            responseReturn(res, 500, { error: 'Internal Server Error' });
        }
    }

    profile_image_upload = async (req, res) => {
        const { id } = req

        try {
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
                    return responseReturn(res, 500, { error: 'Image parsing failed: ' + err.message })
                }

                cloudinary.config({
                    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                    api_key: process.env.CLOUDINARY_API_KEY,
                    api_secret: process.env.CLOUDINARY_API_SECRET,
                    secure: true
                })

                let imageFile = files.image;
                if (Array.isArray(imageFile)) {
                    imageFile = imageFile[0];
                }

                if (!imageFile) {
                    return responseReturn(res, 400, { error: 'No image selected' })
                }

                if (!imageFile.filepath && !imageFile.path) {
                    return responseReturn(res, 400, { error: 'Invalid file upload' })
                }

                const filePath = imageFile.filepath || imageFile.path;

                try {
                    const result = await cloudinary.uploader.upload(filePath, { folder: 'profile' })

                    if (result) {
                        let user = await adminModel.findById(id);
                        if (user) {
                            await adminModel.findByIdAndUpdate(id, { image: result.url })
                            const userInfo = await adminModel.findById(id)
                            responseReturn(res, 201, { message: 'Profile Image Upload Successfully', userInfo })
                        } else {
                            await partnerModel.findByIdAndUpdate(id, { image: result.url })
                            const userInfo = await partnerModel.findById(id)
                            responseReturn(res, 201, { message: 'Profile Image Upload Successfully', userInfo })
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
        const { id } = req;

        try {
            let userInfo;
            let user = await adminModel.findById(id);

            if (user) {
                await adminModel.findByIdAndUpdate(id, { name: name || user.name });
                userInfo = await adminModel.findById(id);
            } else {
                const partner = await partnerModel.findById(id);
                if (!partner) return responseReturn(res, 404, { error: 'User not found' });
                const updatedShopInfo = {
                    ...partner.shopInfo,
                    shopName: shopName || partner.shopInfo?.shopName,
                    division: division || partner.shopInfo?.division,
                    district: district || partner.shopInfo?.district,
                    sub_district: sub_district || partner.shopInfo?.sub_district,
                    address: address || partner.shopInfo?.address,
                    phone: phone || partner.shopInfo?.phone
                };

                await partnerModel.findByIdAndUpdate(id, {
                    name: name || partner.name,
                    shopInfo: updatedShopInfo
                });
                userInfo = await partnerModel.findById(id);
            }

            responseReturn(res, 201, { message: 'Profile updated successfully', userInfo });
        } catch (error) {
            console.error('Profile update error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    logout = async (req, res) => {
        try {
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

    admin_create_partner = async (req, res) => {
        const { email, name, password, phoneNumber, permissions } = req.body
        try {
            if (!email || !name || !password || !phoneNumber) {
                return responseReturn(res, 400, { error: 'Name, Email, Password and Phone Number are required' })
            }
            const getUser = await partnerModel.findOne({ $or: [{ email }, { phoneNumber }] })
            if (getUser) {
                responseReturn(res, 404, { error: 'Email or Phone Number Already Exists' })
            } else {
                const partner = await partnerModel.create({
                    name,
                    email,
                    phoneNumber,
                    password: await bcrypt.hash(password, 10),
                    method: 'menualy',
                    shopInfo: {},
                    status: 'active',
                    permissions: permissions || []
                })
                await partnerCustomerModel.create({ myId: partner.id })
                responseReturn(res, 201, { message: 'Account Created Successfully', admin: partner, partner: partner })
            }
        } catch (error) {
            console.log(error)
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    update_partner_permissions = async (req, res) => {
        const { partnerId, adminId, permissions } = req.body
        const targetId = adminId || partnerId
        try {
            await partnerModel.findByIdAndUpdate(targetId, { permissions })
            responseReturn(res, 200, { message: 'Permissions Updated Successfully' })
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }
    }

    update_partner_password = async (req, res) => {
        const { partnerId, adminId, password } = req.body
        const targetId = adminId || partnerId
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            await partnerModel.findByIdAndUpdate(targetId, { password: hashedPassword })
            responseReturn(res, 200, { message: 'Password Updated Successfully' })
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }
    }

    send_otp = async (req, res) => {
        const { phone } = req.body;
        if (!phone) return responseReturn(res, 400, { error: 'Phone number is required' });

        try {
            const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

            await OTP.findOneAndUpdate(
                { phone },
                { otp: otpCode, createdAt: new Date() },
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
            const otpRecord = await OTP.findOne({ phone, otp });

            if (!otpRecord) {
                return responseReturn(res, 400, { error: 'Invalid or expired OTP' });
            }

            await OTP.deleteOne({ _id: otpRecord._id });

            let customer = await require('../../models/customer/Customer').findOne({ phone });
            let userType = 'Existing';

            if (!customer) {
                userType = 'New';
                customer = await require('../../models/customer/Customer').create({
                    name: 'Guest',
                    phone,
                    email: `user_${Date.now()}@jeenora.com`,
                    password: await bcrypt.hash(Math.random().toString(36), 10),
                    method: 'mobile'
                });
            }

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

            const token = await createToken({ id: customer._id, role: 'user', deviceId: deviceId });
            responseReturn(res, 200, { token, userType, userInfo: customer, message: 'Verification successful' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    update_onboarding = async (req, res) => {
        const { language, gender, ageGroup } = req.body;
        const { id } = req;

        try {
            const customer = await require('../../models/customer/Customer').findByIdAndUpdate(id, {
                onboarding: { language, gender, ageGroup }
            }, { new: true });

            if (!customer) return responseReturn(res, 404, { error: 'User not found' });
            responseReturn(res, 200, { message: 'Onboarding updated successfully', userInfo: customer });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new authControllers()
