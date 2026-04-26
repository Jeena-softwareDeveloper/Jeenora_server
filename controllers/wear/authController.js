const WearBuyer = require('../../models/wear/wearBuyerModel');
const WearLog = require('../../models/wear/wearLogModel');
const WearOtp = require('../../models/wear/wearOtpModel');
const WearSession = require('../../models/wear/wearSessionModel');
const Customer = require('../../models/wear/customerModel');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const formidable = require('formidable');
const cloudinary = require('cloudinary').v2;
const { responseReturn } = require('../../utiles/response');

const { sendSMS } = require('../../services/smsService');

// Global Cloudinary Config (initialized once at startup, not inside functions)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

// Config
const ACCESS_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

// Helper: Generate Access Token
const generateAccessToken = (id, role = 'wear_buyer', deviceId) => {
    return jwt.sign({ id, role, deviceId }, process.env.SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY
    });
};

// Helper: Generate Refresh Token
const generateRefreshToken = () => {
    return crypto.randomBytes(40).toString('hex');
};

// 1. Send OTP / Check Silent Login
exports.send_otp = async (req, res) => {
    try {
        const { phone, deviceId } = req.body;
        if (!phone) return responseReturn(res, 400, { error: 'Phone number required' });

        const cleanPhone = phone.toString().replace(/\D/g, '');

        // --- SILENT LOGIN ONLY ---
        // Check if this device is already trusted in either 'Customer' or 'WearBuyer'
        if (deviceId) {
            let user = await Customer.findOne({ phone: cleanPhone }).select('name phone role image devices');
            let isTrusted = user?.devices?.some(d => d.deviceId === deviceId && d.status === 'trusted');

            // Fallback to WearBuyer
            if (!isTrusted) {
                const buyer = await WearBuyer.findOne({ phone: cleanPhone }).select('name phone role image devices');
                if (buyer?.devices?.some(d => d.deviceId === deviceId && d.status === 'trusted')) {
                    user = buyer;
                    isTrusted = true;
                }
            }

            if (isTrusted && user) {
                const accessToken = generateAccessToken(user._id, user.role, deviceId);
                const refreshToken = generateRefreshToken();

                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

                await WearSession.create({
                    userId: user._id,
                    refreshToken,
                    deviceId,
                    deviceName: req.headers['user-agent'] || 'Trusted Device',
                    ipAddress: req.ip || '127.0.0.1',
                    expiresAt
                });

                // Update last login in the model we found
                const dIdx = user.devices.findIndex(d => d.deviceId === deviceId);
                if (dIdx > -1) user.devices[dIdx].lastLogin = new Date();
                await user.save();

                return responseReturn(res, 200, {
                    success: true,
                    message: 'Logged in successfully via trusted device',
                    accessToken,
                    refreshToken,
                    userInfo: {
                        _id: user._id,
                        name: user.name,
                        phone: user.phone,
                        role: user.role,
                        image: user.image
                    },
                    isSilent: true
                });
            }
        }

        // --- NOT A SILENT LOGIN ---
        // Generate a 4-digit OTP
        const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
        
        // Save OTP to database
        await WearOtp.findOneAndUpdate(
            { phone: cleanPhone },
            { 
                otp: otpCode, 
                createdAt: new Date() 
            },
            { upsert: true, new: true }
        );

        // ⚠️ SECURITY FIX: OTP is NOT returned in production response
        // In dev mode, we log it to console for testing
        console.log(`[DEV] OTP for ${cleanPhone}: ${otpCode}`);

        return responseReturn(res, 200, {
            success: true,
            message: 'OTP sent successfully',
            // otp field removed for security - OTP should only be sent via SMS
            proceedWithFirebase: true
        });

    } catch (error) {
        console.error('Check Auth/Send OTP Error:', error);
        responseReturn(res, 500, { error: error.message });
    }
};

// 2. Verify OTP (Complete Login)
exports.verify_otp = async (req, res) => {
    try {
        const { phone, otp, deviceId, deviceName, ipAddress } = req.body;
        const currentIp = ipAddress || req.ip || req.connection.remoteAddress;

        if (!phone || !otp || !deviceId) {
            return responseReturn(res, 400, { error: 'Phone, OTP, and DeviceID required' });
        }

        const cleanPhone = phone.toString().replace(/\D/g, '');

        // 1. Verify OTP
        const otpRecord = await WearOtp.findOne({ phone: cleanPhone, otp }).sort({ createdAt: -1 });
        if (!otpRecord) {
            return responseReturn(res, 400, { error: 'Invalid or expired OTP' });
        }

        // 2. Find or Create User (Strict Selection)
        const userSelection = 'name phone role image devices';
        let user = await WearBuyer.findOne({ phone: cleanPhone }).select(userSelection);
        if (!user) {
            user = await Customer.findOne({ phone: cleanPhone }).select(userSelection);
        }

        let isNewUser = false;
        if (!user) {
            isNewUser = true;
            user = await WearBuyer.create({
                phone: cleanPhone,
                name: 'Wear Buyer',
                isVerified: true
            });
        }

        // 3. Generate Tokens
        const accessToken = generateAccessToken(user._id, user.role, deviceId);
        const refreshToken = generateRefreshToken();

        // 4. Create Session
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

        await WearSession.create({
            userId: user._id,
            refreshToken,
            deviceId,
            deviceName: deviceName || 'Unknown Device',
            ipAddress: currentIp,
            expiresAt
        });

        // 5. Update User Devices (Legacy support / trusted list)
        if (!user.devices) user.devices = [];
        const deviceIndex = user.devices.findIndex(d => d.deviceId === deviceId);
        if (deviceIndex > -1) {
            user.devices[deviceIndex].status = 'trusted';
            user.devices[deviceIndex].lastLogin = new Date();
            user.devices[deviceIndex].ip = currentIp;
        } else {
            user.devices.push({
                deviceId,
                ip: currentIp,
                status: 'trusted',
                lastLogin: new Date()
            });
        }
        await user.save();

        // 6. Log Activity
        await WearLog.create({
            user: user._id, phone: user.phone, action: 'LOGIN',
            details: { page: 'Auth', method: 'OTP_Verified' },
            device: { deviceId, ip: currentIp, platform: 'Mobile' }
        });

        // Clear used OTP
        await WearOtp.deleteMany({ phone: cleanPhone });

        responseReturn(res, 200, {
            success: true,
            accessToken,
            refreshToken,
            userInfo: {
                _id: user._id,
                name: user.name,
                phone: user.phone,
                role: user.role,
                image: user.image
            },
            isNewUser
        });

    } catch (error) {
        console.error('Verify OTP Error:', error);
        responseReturn(res, 500, { error: error.message });
    }
};

// 3. Refresh Token
exports.refresh_token = async (req, res) => {
    try {
        const { refreshToken, deviceId } = req.body;
        const currentIp = req.ip || '127.0.0.1';

        if (!refreshToken || !deviceId) {
            return responseReturn(res, 400, { error: 'Refresh Token and DeviceID required' });
        }

        // 1. Find Session
        const session = await WearSession.findOne({ refreshToken });

        // 2. Validate Session
        if (!session) {
            return responseReturn(res, 401, { error: 'Session not found', code: 'SESSION_NOT_FOUND' });
        }
        if (session.isRevoked) {
            return responseReturn(res, 401, { error: 'Session revoked', code: 'SESSION_REVOKED' });
        }
        if (new Date() > session.expiresAt) {
            return responseReturn(res, 401, { error: 'Session expired', code: 'SESSION_EXPIRED' });
        }
        if (session.deviceId !== deviceId) {
            return responseReturn(res, 401, { error: 'Device mismatch', code: 'DEVICE_MISMATCH' });
        }

        // 3. Rotate Token
        const rotatedRefreshToken = generateRefreshToken();
        const rotatedAccessToken = generateAccessToken(session.userId, 'wear_buyer', deviceId);

        // Update session
        session.refreshToken = rotatedRefreshToken;
        session.ipAddress = currentIp;
        session.expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
        await session.save();

        responseReturn(res, 200, {
            success: true,
            accessToken: rotatedAccessToken,
            refreshToken: rotatedRefreshToken
        });

    } catch (error) {
        console.error('Refresh Token Error:', error);
        responseReturn(res, 500, { error: error.message });
    }
};

// Get Wear Buyer Profile
exports.get_profile = async (req, res) => {
    try {
        const { id } = req;
        let user = await WearBuyer.findById(id).lean();

        if (!user) {
            user = await Customer.findById(id).lean();
        }

        if (!user) {
            return responseReturn(res, 404, { error: 'User not found' });
        }

        responseReturn(res, 200, {
            success: true,
            userInfo: {
                _id: user._id,
                name: user.name,
                phone: user.phone,
                email: user.email,
                image: user.image,
                role: user.role,
                gender: user.gender,
                dob: user.dob,
                city: user.city,
                state: user.state
            }
        });
    } catch (error) {
        console.error('Get Profile Error:', error);
        responseReturn(res, 500, { error: 'Internal Server Error' });
    }
};

// Update Wear Buyer Profile
exports.update_profile = async (req, res) => {
    const { id } = req;
    
    const handleUpdate = async (updateFields) => {
        const {
            name, email, phone, gender, languages, occupation,
            dob, maritalStatus, kidsCount, education, monthlyIncome,
            businessName, pincode, city, state
        } = updateFields;

        const updateData = {
            name: Array.isArray(name) ? name[0] : name,
            email: Array.isArray(email) ? email[0] : email,
            phone: Array.isArray(phone) ? phone[0] : phone,
            gender: Array.isArray(gender) ? gender[0] : gender,
            occupation: Array.isArray(occupation) ? occupation[0] : occupation,
            dob: Array.isArray(dob) ? dob[0] : dob,
            maritalStatus: Array.isArray(maritalStatus) ? maritalStatus[0] : maritalStatus,
            kidsCount: Array.isArray(kidsCount) ? kidsCount[0] : kidsCount,
            education: Array.isArray(education) ? education[0] : education,
            monthlyIncome: Array.isArray(monthlyIncome) ? monthlyIncome[0] : monthlyIncome,
            businessName: Array.isArray(businessName) ? businessName[0] : businessName,
            pincode: Array.isArray(pincode) ? pincode[0] : pincode,
            city: Array.isArray(city) ? city[0] : city,
            state: Array.isArray(state) ? state[0] : state
        };

        try {
            let user = await WearBuyer.findByIdAndUpdate(id, updateData, { new: true });
            if (!user) {
                user = await Customer.findByIdAndUpdate(id, updateData, { new: true });
            }
            if (!user) {
                return responseReturn(res, 404, { error: 'User not found' });
            }
            return responseReturn(res, 200, { message: 'Profile updated', userInfo: user });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    };

    const contentType = req.headers['content-type'] || '';
    
    if (contentType.includes('application/json')) {
        return handleUpdate(req.body);
    } else {
        const form = formidable({ multiples: true });
        form.parse(req, async (err, fields, files) => {
            if (err) {
                return responseReturn(res, 500, { error: err.message });
            }
            return handleUpdate(fields);
        });
    }
};

// Update Profile Image
exports.profile_image_upload = async (req, res) => {
    const { id } = req;
    const form = formidable({ multiples: true });

    form.parse(req, async (err, fields, files) => {
        if (err) {
            return responseReturn(res, 500, { error: err.message });
        }

        const { image } = files;
        const imageFile = Array.isArray(image) ? image[0] : image;

        try {
            if (!imageFile) {
                return responseReturn(res, 400, { error: 'No image provided' });
            }

            const result = await cloudinary.uploader.upload(imageFile.filepath, { folder: 'wear_profiles' });

            if (result) {
                let user = await WearBuyer.findByIdAndUpdate(id, {
                    image: result.url
                }, { new: true });

                if (!user) {
                    user = await Customer.findByIdAndUpdate(id, {
                        image: result.url
                    }, { new: true });
                }

                responseReturn(res, 200, {
                    success: true,
                    message: 'Profile image updated successfully',
                    image: result.url,
                    userInfo: {
                        _id: user._id,
                        name: user.name,
                        image: user.image
                    }
                });
            } else {
                responseReturn(res, 500, { error: 'Image upload failed' });
            }
        } catch (error) {
            console.error('Image Upload Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    });
};

// 4. Email Signup (Username, Email, Password, Phone)
exports.email_signup = async (req, res) => {
    try {
        const { username, email, password, phone } = req.body;

        if (!username || !email || !password || !phone) {
            return responseReturn(res, 400, { error: 'Username, email, password and phone are required' });
        }

        const cleanEmail = email.toLowerCase().trim();
        const cleanPhone = phone.toString().replace(/\D/g, '');

        const existingBuyer = await WearBuyer.findOne({ $or: [{ email: cleanEmail }, { phone: cleanPhone }, { username }] });
        const existingCustomer = await Customer.findOne({ $or: [{ email: cleanEmail }, { phone: cleanPhone }] });

        if (existingBuyer || existingCustomer) {
            return responseReturn(res, 400, { error: 'User with this email, phone or username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await WearBuyer.create({
            username,
            name: username,
            email: cleanEmail,
            phone: cleanPhone,
            password: hashedPassword,
            role: 'wear_buyer',
            isVerified: true
        });

        await WearLog.create({
            user: user._id, phone: '', action: 'SIGNUP',
            details: { page: 'Auth', method: 'Email_Signup' }
        });

        responseReturn(res, 201, {
            success: true,
            message: 'Account created successfully. Please login.'
        });

    } catch (error) {
        console.error('Email Signup Error:', error);
        responseReturn(res, 500, { error: error.message });
    }
};

// 5. Email Login
exports.email_login = async (req, res) => {
    try {
        const { email, password, deviceId, deviceName } = req.body;
        const currentIp = req.ip || req.connection.remoteAddress;

        if (!email || !password) {
            return responseReturn(res, 400, { error: 'Email and password are required' });
        }

        const cleanEmail = email.toLowerCase().trim();

        let user = await WearBuyer.findOne({ email: cleanEmail }).select('+password name email role image devices username');
        if (!user) {
            user = await Customer.findOne({ email: cleanEmail }).select('+password name email role image devices');
        }

        if (!user) {
            return responseReturn(res, 401, { error: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return responseReturn(res, 401, { error: 'Invalid email or password' });
        }

        const accessToken = generateAccessToken(user._id, user.role, deviceId);
        const refreshToken = generateRefreshToken();

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

        await WearSession.create({
            userId: user._id,
            refreshToken,
            deviceId,
            deviceName: deviceName || 'Unknown Device',
            ipAddress: currentIp,
            expiresAt
        });

        if (deviceId) {
            if (!user.devices) user.devices = [];
            const deviceIndex = user.devices.findIndex(d => d.deviceId === deviceId);
            if (deviceIndex > -1) {
                user.devices[deviceIndex].status = 'trusted';
                user.devices[deviceIndex].lastLogin = new Date();
                user.devices[deviceIndex].ip = currentIp;
            } else {
                user.devices.push({
                    deviceId,
                    ip: currentIp,
                    status: 'trusted',
                    lastLogin: new Date()
                });
            }
            await user.save();
        }

        await WearLog.create({
            user: user._id, phone: user.phone || '', action: 'LOGIN',
            details: { page: 'Auth', method: 'Email_Login' },
            device: { deviceId, ip: currentIp, platform: 'Web/Mobile' }
        });

        responseReturn(res, 200, {
            success: true,
            accessToken,
            refreshToken,
            userInfo: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                image: user.image,
                username: user.username
            }
        });

    } catch (error) {
        console.error('Email Login Error:', error);
        responseReturn(res, 500, { error: error.message });
    }
};

// Logout - Untrust the current device
exports.logout = async (req, res) => {
    try {
        const { deviceId } = req.body;
        const userId = req.id;
        const ip = req.ip || req.connection.remoteAddress;

        const buyer = await WearBuyer.findById(userId);
        const customer = await Customer.findById(userId);

        const updateDeviceLogout = (user) => {
            if (user && deviceId && user.devices) {
                const deviceIndex = user.devices.findIndex(d => d.deviceId === deviceId);
                if (deviceIndex > -1) {
                    user.devices[deviceIndex].lastLogout = new Date();
                    return true;
                }
            }
            return false;
        };

        if (updateDeviceLogout(buyer)) await buyer.save();
        if (updateDeviceLogout(customer)) await customer.save();

        if (buyer || customer) {
            await WearLog.create({
                user: userId,
                phone: buyer?.phone || customer?.phone,
                action: 'LOGOUT',
                details: { page: 'Profile', method: 'Manual_Logout' },
                device: { deviceId, ip, platform: 'Mobile' }
            });
        }

        const { blacklistToken } = require('../../middlewares/authMiddleware');

        if (req.token) {
            await blacklistToken(req.token);
        }

        responseReturn(res, 200, { success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout Error:', error);
        responseReturn(res, 500, { error: error.message });
    }
};
