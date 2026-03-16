const jwt = require('jsonwebtoken');
const Customer = require('../../models/wear/customerModel');

/**
 * Google Login Controller
 * Handles Google OAuth authentication for mobile app
 */
exports.googleLogin = async (req, res) => {
    try {
        const { email, name, picture, deviceId } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check if customer exists
        let customer = await Customer.findOne({ email });

        if (!customer) {
            customer = await Customer.create({
                name: name || email.split('@')[0],
                email,
                image: picture || '',
                phone: '', // Optional
                password: 'google-auth-' + email,
                method: 'google',
                role: 'user'
            });
        }

        // --- DASHBOARD SYNC: Ensure they are in WearBuyer for the Admin Panel ---
        const WearBuyer = require('../../models/wear/wearBuyerModel');
        let wearBuyer = await WearBuyer.findOne({ email });
        if (!wearBuyer) {
            wearBuyer = await WearBuyer.create({
                name: customer.name,
                phone: customer.phone || '',
                email: customer.email,
                status: 'active'
            });
        }

        // Handle Device Registration for both
        if (deviceId) {
            const registerDevice = (user) => {
                if (!user.devices) user.devices = [];
                const dIdx = user.devices.findIndex(d => d.deviceId === deviceId);
                if (dIdx > -1) {
                    user.devices[dIdx].lastLogin = new Date();
                    user.devices[dIdx].status = 'trusted';
                    // Update IP and UserAgent if they exist on the user model's device schema
                    if (user.devices[dIdx].ip !== undefined) user.devices[dIdx].ip = ip;
                    if (user.devices[dIdx].userAgent !== undefined) user.devices[dIdx].userAgent = userAgent;
                } else {
                    const newDevice = { deviceId, status: 'trusted', lastLogin: new Date() };
                    // Add IP and UserAgent only if the user model's device schema supports them
                    if (user.schema.path('devices.0.ip')) newDevice.ip = ip;
                    if (user.schema.path('devices.0.userAgent')) newDevice.userAgent = userAgent;
                    user.devices.push(newDevice);
                }
            };

            registerDevice(customer);
            registerDevice(wearBuyer);

            await customer.save();
            await wearBuyer.save();
        }

        // Create Session in DB for Refreshing
        const WearSession = require('../../models/wear/wearSessionModel');
        const crypto = require('crypto');
        const refreshToken = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 Days

        if (deviceId) {
            await WearSession.create({
                userId: customer._id,
                refreshToken,
                deviceId,
                deviceName: userAgent || 'Google Login (Mobile)',
                ipAddress: ip,
                expiresAt
            });
        }

        // Generate JWT token with 7 days expiry
        const token = jwt.sign(
            {
                id: customer._id,
                role: customer.role,
                email: customer.email,
                deviceId: deviceId
            },
            process.env.SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            refreshToken, // Support refreshing
            userInfo: {
                id: customer._id,
                name: customer.name,
                email: customer.email,
                image: picture || customer.image || '',
                phone: customer.phone,
                role: customer.role
            }
        });

    } catch (error) {
        console.error('Google Login Error:', error);
        res.status(500).json({
            error: 'Failed to authenticate with Google',
            message: error.message
        });
    }
};
