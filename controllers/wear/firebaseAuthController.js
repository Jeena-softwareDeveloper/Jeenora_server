const jwt = require('jsonwebtoken');
const Customer = require('../../models/wear/customerModel');
const crypto = require('crypto');
const WearSession = require('../../models/wear/wearSessionModel');

/**
 * Firebase Phone Login Controller
 * Finalizes login after Firebase verify the phone on client side
 */
exports.firebasePhoneLogin = async (req, res) => {
    try {
        const { phone, uid, name, email, deviceId } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Check if customer exists by phone
        let customer = await Customer.findOne({ phone });
        const WearBuyer = require('../../models/wear/wearBuyerModel');

        if (!customer) {
            // Create new customer
            customer = await Customer.create({
                name: name || 'Wear User',
                email: email || `user_${Date.now()}@jeenora.com`,
                phone,
                password: 'firebase-auth-' + uid,
                method: 'phone',
                role: 'user'
            });
        }

        // --- DASHBOARD SYNC: Ensure they are in WearBuyer for the Admin Panel ---
        let wearBuyer = await WearBuyer.findOne({ phone });
        if (!wearBuyer) {
            wearBuyer = await WearBuyer.create({
                name: customer.name,
                phone: customer.phone,
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
                    user.devices[dIdx].ip = ip;
                    user.devices[dIdx].lastLogin = new Date();
                    user.devices[dIdx].status = 'trusted';
                } else {
                    user.devices.push({ deviceId, ip, userAgent, status: 'trusted', lastLogin: new Date() });
                }
            };

            registerDevice(customer);
            registerDevice(wearBuyer);

            await customer.save();
            await wearBuyer.save();
        }

        // Generate Tokens (Session Based)
        const accessToken = jwt.sign(
            { id: customer._id, role: customer.role, deviceId },
            process.env.SECRET || 'fourat',
            { expiresIn: '7d' }
        );

        // Generate Refresh Token
        const refreshToken = crypto.randomBytes(40).toString('hex');

        // Create Session in DB
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 Days

        if (deviceId) {
            await WearSession.create({
                userId: customer._id,
                refreshToken,
                deviceId,
                deviceName: userAgent || 'Mobile App',
                ipAddress: ip,
                expiresAt
            });
        }

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token: accessToken,
            refreshToken, // Critical for Silent Refresh
            userInfo: {
                id: customer._id,
                name: customer.name,
                email: customer.email,
                image: customer.image || '',
                phone: customer.phone,
                role: customer.role
            }
        });

    } catch (error) {
        console.error('Firebase Phone Login Error:', error);
        res.status(500).json({
            error: 'Failed to login with Firebase Phone',
            message: error.message
        });
    }
};
