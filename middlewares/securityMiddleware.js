const rateLimit = require('express-rate-limit');

/**
 * Highly Strict Limiter for OTP Generation
 * Prevents SMS/Email spamming.
 */
module.exports.otpSendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 100000 : 5, // Limit increased for dev testing
    message: {
        error: 'Too many OTP requests from this IP, please try again after 15 minutes',
        success: false
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Strict Limiter for OTP Verification
 * Prevents brute-forcing the 6-digit code.
*/

module.exports.otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'development' ? 100000 : 10,
    message: {
        error: 'Too many verification attempts, please try again after 15 minutes',
        success: false
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Limiter for Authentication (Login/Register)
 * Prevents credential stuffing attacks.
 */
module.exports.authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'development' ? 100000 : 10,
    message: {
        error: 'Too many login attempts, please try again after 15 minutes',
        success: false
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * General API Limiter
 * Basic protection against DoS for public endpoints.
 */
module.exports.apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: process.env.NODE_ENV === 'development' ? 100000 : 100,
    message: {
        error: 'Too many requests, please slow down',
        success: false
    },
    standardHeaders: true,
    legacyHeaders: false,
});
