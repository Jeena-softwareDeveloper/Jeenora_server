const WearBuyer = require('../../models/customer/wearBuyerModel');
const WearLog = require('../../models/admin/WearLog');
const WearOtp = require('../../models/admin/WearOtp');
const WearSession = require('../../models/customer/wearSessionModel');
const Customer = require('../../models/customer/Customer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const formidable = require('formidable');
const cloudinary = require('cloudinary').v2;
const { responseReturn } = require('../../utils/response');

const { sendSMS } = require('../../services/smsService');
const whatsappClient = require('../../utils/whatsappClient');

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
        if (deviceId) {
            let user = await Customer.findOne({ phone: cleanPhone }).select('name phone role image devices');
            let isTrusted = user?.devices?.some(d => d.deviceId === deviceId && d.status === 'trusted');

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
                    userId: user._id, refreshToken, deviceId,
                    deviceName: req.headers['user-agent'] || 'Trusted Device',
                    ipAddress: req.ip || '127.0.0.1', expiresAt
                });

                const dIdx = user.devices.findIndex(d => d.deviceId === deviceId);
                if (dIdx > -1) user.devices[dIdx].lastLogin = new Date();
                await user.save();

                return responseReturn(res, 200, {
                    success: true, message: 'Logged in successfully via trusted device',
                    accessToken, refreshToken, userInfo: { _id: user._id, name: user.name, phone: user.phone, role: user.role, image: user.image },
                    isSilent: true
                });
            }
        }

        // --- NOT A SILENT LOGIN ---
        const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
        await WearOtp.findOneAndUpdate({ phone: cleanPhone }, { otp: otpCode, createdAt: new Date() }, { upsert: true, new: true });

        // Send OTP via WhatsApp
        try {
            await whatsappClient.sendMessage(cleanPhone, `🔐 *Jeenora Verification*\n\nYour OTP code is: *${otpCode}*\n\nThis code will expire in 5 minutes. Do not share it with anyone.`);
        } catch (waError) {
            console.error('[WhatsApp] Failed to send OTP:', waError.message);
        }

        console.log(`[DEV] OTP for ${cleanPhone}: ${otpCode}`);

        return responseReturn(res, 200, {
            success: true,
            message: 'OTP sent successfully',
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

        // 2. Find or Create User
        const userSelection = 'name phone role image devices isDeleted';
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

            // Send Welcome Message via WhatsApp
            try {
                await whatsappClient.sendMessage(cleanPhone, `🎉 *Welcome to Jeenora!*\n\nThank you for registering. Your account has been successfully created. Explore our latest collections now!\n\n🌐 https://jeenora.com`);
            } catch (waError) {
                console.error('[WhatsApp] Failed to send welcome message:', waError.message);
            }
        }

        if (user.isDeleted) {
            user.isDeleted = false;
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

        // 5. Update User Devices
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

        const session = await WearSession.findOne({ refreshToken });
        if (!session) return responseReturn(res, 401, { error: 'Session not found', code: 'SESSION_NOT_FOUND' });
        if (session.isRevoked) return responseReturn(res, 401, { error: 'Session revoked', code: 'SESSION_REVOKED' });
        if (new Date() > session.expiresAt) return responseReturn(res, 401, { error: 'Session expired', code: 'SESSION_EXPIRED' });
        if (session.deviceId !== deviceId) return responseReturn(res, 401, { error: 'Device mismatch', code: 'DEVICE_MISMATCH' });

        const rotatedRefreshToken = generateRefreshToken();
        const rotatedAccessToken = generateAccessToken(session.userId, 'wear_buyer', deviceId);

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
        if (!user) user = await Customer.findById(id).lean();
        if (!user) return responseReturn(res, 404, { error: 'User not found' });

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
                state: user.state,
                emailVerified: user.emailVerified ?? true
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
            name, email, phone, gender, occupation,
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
            if (!user) user = await Customer.findByIdAndUpdate(id, updateData, { new: true });
            if (!user) return responseReturn(res, 404, { error: 'User not found' });
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
            if (err) return responseReturn(res, 500, { error: err.message });
            return handleUpdate(fields);
        });
    }
};

// Update Profile Image
exports.profile_image_upload = async (req, res) => {
    const { id } = req;
    const form = formidable({ multiples: true });

    form.parse(req, async (err, fields, files) => {
        if (err) return responseReturn(res, 500, { error: err.message });

        const { image } = files;
        const imageFile = Array.isArray(image) ? image[0] : image;

        try {
            if (!imageFile) return responseReturn(res, 400, { error: 'No image provided' });

            const result = await cloudinary.uploader.upload(imageFile.filepath, { folder: 'wear_profiles' });

            if (result) {
                let user = await WearBuyer.findByIdAndUpdate(id, { image: result.url }, { new: true });
                if (!user) user = await Customer.findByIdAndUpdate(id, { image: result.url }, { new: true });

                responseReturn(res, 200, {
                    success: true,
                    message: 'Profile image updated successfully',
                    image: result.url,
                    userInfo: { _id: user._id, name: user.name, image: user.image }
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

// 4. Email Signup
exports.email_signup = async (req, res) => {
    try {
        const { username, email, password, phone } = req.body;
        if (!username || !email || !password || !phone) return responseReturn(res, 400, { error: 'Username, email, password and phone are required' });

        const cleanEmail = email.toLowerCase().trim();
        const cleanPhone = phone.toString().replace(/\D/g, '');

        const existingEmail = await WearBuyer.findOne({ email: cleanEmail }) || await Customer.findOne({ email: cleanEmail });
        if (existingEmail) return responseReturn(res, 400, { error: 'This email address is already in use' });

        const existingPhone = await WearBuyer.findOne({ phone: cleanPhone }) || await Customer.findOne({ phone: cleanPhone });
        if (existingPhone) return responseReturn(res, 400, { error: 'This phone number is already in use' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const verifyToken = crypto.randomBytes(32).toString('hex');

        const user = await WearBuyer.create({
            username, name: username, email: cleanEmail, phone: cleanPhone,
            password: hashedPassword, role: 'wear_buyer', isVerified: true,
            emailVerified: false, emailVerifyToken: verifyToken
        });

        // WhatsApp Welcome (Even for email signup)
        try {
            await whatsappClient.sendMessage(cleanPhone, `🎉 *Welcome to Jeenora!*\n\nThank you for registering with us. We're excited to have you on board!\n\n🌐 https://jeenora.com`);
        } catch (waErr) {
            console.error('[WhatsApp Signup Error]', waErr.message);
        }

        try {
            const { sendEmail } = require('../../utils/emailSender');
            const frontendUrl = process.env.FRONTEND_URL || 'https://www.jeenora.com';
            const verifyUrl = `${frontendUrl}/verify-email?token=${verifyToken}&id=${user._id}`;
            const html = `<div style="font-family:Arial;padding:20px;"><h2>Verify Email</h2><a href="${verifyUrl}">Click here to verify</a></div>`;
            await sendEmail(cleanEmail, 'Verify your Jeenora account', `Verify your email: ${verifyUrl}`, html);
        } catch (mailErr) {
            console.error('[Email Verification Send Error]', mailErr.message);
        }

        responseReturn(res, 201, { success: true, message: 'Account created! Check your email to verify your account.' });

    } catch (error) {
        console.error('Email Signup Error:', error);
        responseReturn(res, 500, { error: error.message });
    }
};

// 4.1 Resend Verification Email
exports.resend_verification_email = async (req, res) => {
    try {
        const { id } = req;
        const user = await WearBuyer.findById(id).select('+emailVerifyToken +emailVerified');
        if (!user) return responseReturn(res, 404, { error: 'User not found' });
        if (user.emailVerified) return responseReturn(res, 400, { error: 'Email already verified' });

        const verifyToken = crypto.randomBytes(32).toString('hex');
        user.emailVerifyToken = verifyToken;
        await user.save();

        const { sendEmail } = require('../../utils/emailSender');
        const frontendUrl = process.env.FRONTEND_URL || 'https://www.jeenora.com';
        const verifyUrl = `${frontendUrl}/verify-email?token=${verifyToken}&id=${user._id}`;
        const html = `<div style="font-family:Arial;padding:20px;"><h2>Verify Email</h2><a href="${verifyUrl}">Click here to verify</a></div>`;
        await sendEmail(user.email, 'Verify your Jeenora account', `Verify your email: ${verifyUrl}`, html);

        responseReturn(res, 200, { success: true, message: 'Verification email sent!' });
    } catch (error) {
        console.error('Resend Verification Error:', error);
        responseReturn(res, 500, { error: error.message });
    }
};

// 4.2 Verify Email Token
exports.verify_email_token = async (req, res) => {
    let { token, id } = req.query;
    try {
        if (!token || !id) return responseReturn(res, 400, { error: 'Invalid verification link' });
        let user = await WearBuyer.findById(id).select('+emailVerifyToken +emailVerified');
        if (!user) user = await Customer.findById(id).select('+emailVerifyToken +emailVerified');
        if (!user) return responseReturn(res, 404, { error: 'User not found' });
        if (user.emailVerified) return responseReturn(res, 200, { success: true, message: 'Email already verified' });
        if (user.emailVerifyToken !== token) return responseReturn(res, 400, { error: 'Invalid or expired token' });

        user.emailVerified = true;
        user.isVerified = true;
        user.emailVerifyToken = undefined;
        await user.save();

        responseReturn(res, 200, { success: true, message: 'Email verified successfully!' });
    } catch (error) {
        console.error('Verify Email Token Error:', error);
        responseReturn(res, 500, { error: 'Internal Server Error' });
    }
};

// 4.3 Forgot Password
exports.forgot_password = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return responseReturn(res, 400, { error: 'Email is required' });

        const cleanEmail = email.toLowerCase().trim();
        let user = await WearBuyer.findOne({ email: cleanEmail }).select('+resetPasswordToken +resetPasswordExpiry phone');
        if (!user) user = await Customer.findOne({ email: cleanEmail }).select('+resetPasswordToken +resetPasswordExpiry phone');

        if (!user) return responseReturn(res, 200, { success: true, message: 'If that email exists, a reset link has been sent.' });

        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpiry = new Date(Date.now() + 60 * 60 * 1000);
        await user.save();

        // Send WhatsApp Alert for Forgot Password request
        try {
            await whatsappClient.sendMessage(user.phone, `🔑 *Security Alert: Password Reset*\n\nA request to reset your Jeenora password was made. If this wasn't you, please secure your account. Otherwise, follow the instructions sent to your email.`);
        } catch (waErr) {
            console.error('[WhatsApp Forgot Password Error]', waErr.message);
        }

        const { sendEmail } = require('../../utils/emailSender');
        const frontendUrl = process.env.FRONTEND_URL || 'https://www.jeenora.com';
        const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&id=${user._id}`;
        const html = `<div style="font-family:Arial;padding:20px;"><h2>Reset Password</h2><a href="${resetUrl}">Click here to reset</a></div>`;
        await sendEmail(cleanEmail, 'Reset your Jeenora password', `Reset your password: ${resetUrl}`, html);

        responseReturn(res, 200, { success: true, message: 'If that email exists, a reset link has been sent.' });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        responseReturn(res, 500, { error: error.message });
    }
};

// 4.4 Reset Password
exports.reset_password = async (req, res) => {
    try {
        const { token, id, newPassword } = req.body;
        if (!token || !id || !newPassword) return responseReturn(res, 400, { error: 'Token, ID, and new password are required' });

        let user = await WearBuyer.findById(id).select('+password +resetPasswordToken +resetPasswordExpiry +isDeleted phone');
        if (!user) user = await Customer.findById(id).select('+password +resetPasswordToken +resetPasswordExpiry +isDeleted phone');

        if (!user) return responseReturn(res, 404, { error: 'Invalid reset link' });
        if (user.resetPasswordToken !== token) return responseReturn(res, 400, { error: 'Invalid or expired token' });
        if (!user.resetPasswordExpiry || new Date() > user.resetPasswordExpiry) return responseReturn(res, 400, { error: 'Reset link has expired' });

        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiry = undefined;
        user.isDeleted = false;
        await user.save();

        // WhatsApp Confirmation
        try {
            await whatsappClient.sendMessage(user.phone, `✅ *Success! Password Reset*\n\nYour Jeenora account password has been successfully reset. You can now log in with your new password.`);
        } catch (waErr) {
            console.error('[WhatsApp Reset Success Error]', waErr.message);
        }

        responseReturn(res, 200, { success: true, message: 'Password reset successfully! You can now login.' });
    } catch (error) {
        console.error('Reset Password Error:', error);
        responseReturn(res, 500, { error: error.message });
    }
};

// 5. Email Login
exports.email_login = async (req, res) => {
    try {
        const { email, password, deviceId, deviceName } = req.body;
        const currentIp = req.ip || '127.0.0.1';

        const input = email.toLowerCase().trim();
        const isEmail = input.includes('@');
        const cleanInput = isEmail ? input : input.replace(/\D/g, '');
        let query = isEmail ? { email: input } : { phone: cleanInput };

        let user = await WearBuyer.findOne(query).select('+password name email role image devices phone isDeleted');
        if (!user) user = await Customer.findOne(query).select('+password name email role image devices phone isDeleted');

        if (user && user.isDeleted) return responseReturn(res, 403, { error: 'Your account has been deleted.' });
        if (!user) return responseReturn(res, 401, { error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return responseReturn(res, 401, { error: 'Invalid email or password' });

        const accessToken = generateAccessToken(user._id, user.role, deviceId);
        const refreshToken = generateRefreshToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

        await WearSession.create({
            userId: user._id, refreshToken, deviceId,
            deviceName: deviceName || 'Unknown Device',
            ipAddress: currentIp, expiresAt
        });

        if (deviceId) {
            if (!user.devices) user.devices = [];
            const dIdx = user.devices.findIndex(d => d.deviceId === deviceId);
            if (dIdx > -1) {
                user.devices[dIdx].status = 'trusted';
                user.devices[dIdx].lastLogin = new Date();
            } else {
                user.devices.push({ deviceId, ip: currentIp, status: 'trusted', lastLogin: new Date() });
            }
            await user.save();
        }

        await WearLog.create({
            user: user._id, phone: user.phone || '', action: 'LOGIN',
            details: { page: 'Auth', method: 'Email_Login' }
        });

        responseReturn(res, 200, {
            success: true, accessToken, refreshToken,
            userInfo: { _id: user._id, name: user.name, email: user.email, role: user.role, image: user.image }
        });

    } catch (error) {
        console.error('Email Login Error:', error);
        responseReturn(res, 500, { error: error.message });
    }
};

// Logout
exports.logout = async (req, res) => {
    try {
        const { deviceId } = req.body;
        const userId = req.id;
        const buyer = await WearBuyer.findById(userId);
        const customer = await Customer.findById(userId);

        const updateDevice = (user) => {
            if (user && deviceId && user.devices) {
                const idx = user.devices.findIndex(d => d.deviceId === deviceId);
                if (idx > -1) user.devices[idx].lastLogout = new Date();
                return true;
            }
            return false;
        };

        if (updateDevice(buyer)) await buyer.save();
        if (updateDevice(customer)) await customer.save();

        responseReturn(res, 200, { success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout Error:', error);
        responseReturn(res, 500, { error: error.message });
    }
};

// 10. Delete Account
exports.delete_account = async (req, res) => {
    try {
        const { password } = req.body;
        const { id } = req;
        const user = await WearBuyer.findById(id).select('+password');
        if (!user) return responseReturn(res, 404, { error: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return responseReturn(res, 401, { error: 'Incorrect password' });

        user.isDeleted = true;
        await user.save();
        await WearSession.deleteMany({ userId: id });

        responseReturn(res, 200, { success: true, message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete Account Error:', error);
        responseReturn(res, 500, { error: error.message });
    }
};

