// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const TokenBlacklist = require('../models/security/tokenBlacklistModel');
const LoginAttempt = require('../models/security/loginAttemptModel');

module.exports.authMiddleware = async (req, res, next) => {
    try {
        let token = req.headers.authorization?.replace('Bearer ', '') ||
            req.headers['x-access-token'] ||
            req.cookies.accessToken;

        if (!token) {
            return res.status(401).json({ error: 'Please login first' });
        }

        // Check if token is blacklisted (logged out)
        const blacklisted = await TokenBlacklist.findOne({ token });
        if (blacklisted) {
            return res.status(401).json({ error: 'Session has been invalidated. Please login again.' });
        }

        const deCodeToken = await jwt.verify(token, process.env.SECRET);
        req.role = deCodeToken.role;
        req.id = deCodeToken.id;
        req.user = deCodeToken;
        req.token = token;

        // --- ARCHITECTURE TUNE: Resolve Business ID (Supplier/Partner) ---
        const Supplier = require('../models/partner/Supplier');
        const supplier = await Supplier.findOne({ user: req.id });
        
        if (supplier) {
            req.businessId = supplier._id.toString();
            req.businessInfo = supplier;
        } else {
            req.businessId = req.id; // Fallback to raw ID (Legacy Partner or Buyer)
        }

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Session expired, please login again' });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid session token' });
        } else {
            console.error('[AUTH_MIDDLEWARE_ERROR]', error.message);
            return res.status(500).json({ error: 'Authentication failed' });
        }
    }
};

// -----------------------------------------------
// Super Admin Only Guard
// -----------------------------------------------
module.exports.superAdminMiddleware = async (req, res, next) => {
    try {
        if (req.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Super Administrator privileges required.' });
        }
        next();
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// -----------------------------------------------
// Admin Role Guard (Allows both superadmin and admin)
// -----------------------------------------------
module.exports.adminMiddleware = async (req, res, next) => {
    try {
        if (req.role !== 'admin' && req.role !== 'manager') {
            return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
        }
        next();
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

module.exports.partnerAdminMiddleware = async (req, res, next) => {
    try {
        if (req.role !== 'admin' && req.role !== 'manager' && req.role !== 'partner') {
            return res.status(403).json({ error: 'Access denied. Unauthorized role.' });
        }
        next();
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// -----------------------------------------------
// Optional Auth (for public + authenticated routes)
// -----------------------------------------------
module.exports.authOptional = async (req, res, next) => {
    try {
        let token = req.headers.authorization?.replace('Bearer ', '') ||
            req.headers['x-access-token'] ||
            req.cookies.accessToken;

        if (token) {
            const blacklisted = await TokenBlacklist.findOne({ token });
            if (!blacklisted) {
                const deCodeToken = await jwt.verify(token, process.env.SECRET);
                req.role = deCodeToken.role;
                req.id = deCodeToken.id;
                req.user = deCodeToken;
                req.token = token;
            }
        }
        next();
    } catch (error) {
        next(); // Don't block on error — optional auth
    }
};

// -----------------------------------------------
// Account Lockout Helpers (used in auth controllers)
// -----------------------------------------------
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

module.exports.checkAccountLock = async (email) => {
    const record = await LoginAttempt.findOne({ email });
    if (!record) return { locked: false };

    if (record.lockedUntil && new Date() < record.lockedUntil) {
        const remaining = Math.ceil((record.lockedUntil - new Date()) / 1000 / 60);
        return { locked: true, remaining };
    }
    return { locked: false, attempts: record.attempts };
};

module.exports.recordFailedLogin = async (email, ip) => {
    const record = await LoginAttempt.findOne({ email });

    if (!record) {
        await LoginAttempt.create({ email, ip, attempts: 1 });
        return;
    }

    record.attempts += 1;
    record.ip = ip;
    record.lastAttemptAt = new Date();
    record.expiresAt = new Date(Date.now() + LOCK_DURATION_MS);

    if (record.attempts >= MAX_ATTEMPTS) {
        record.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
        console.warn(`🔒 [SECURITY] Account locked for: ${email} from IP: ${ip}`);
    }
    await record.save();
};

module.exports.clearFailedLogins = async (email) => {
    await LoginAttempt.deleteOne({ email });
};

// -----------------------------------------------
// Token Blacklist Helper (used on logout)
// -----------------------------------------------
module.exports.blacklistToken = async (token) => {
    try {
        const decoded = jwt.decode(token);
        if (!decoded || !decoded.exp) return;

        const expiresAt = new Date(decoded.exp * 1000);
        await TokenBlacklist.findOneAndUpdate(
            { token },
            { token, expiresAt },
            { upsert: true, new: true }
        );
    } catch (e) {
        console.error('Token blacklist error:', e.message);
    }
};