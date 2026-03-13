// middlewares/validationMiddleware.js
const { body, validationResult } = require('express-validator');

/**
 * Central validation error handler.
 * Returns the first validation error as a clean JSON response.
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: errors.array()[0].msg,
            success: false
        });
    }
    next();
};

// -----------------------------------------------
// Auth Validators
// -----------------------------------------------

/** Login - Validate email + password presence and format */
module.exports.validateLogin = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Enter a valid email address')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validate,
];

/** Registration - Validate all required fields */
module.exports.validateRegister = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 60 }).withMessage('Name must be 2–60 characters'),
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Enter a valid email address')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number'),
    validate,
];

/** OTP Send - Validate email */
module.exports.validateOtpSend = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Enter a valid email address')
        .normalizeEmail(),
    validate,
];

/** OTP Verify - Validate email + OTP code */
module.exports.validateOtpVerify = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Enter a valid email address')
        .normalizeEmail(),
    body('otp')
        .notEmpty().withMessage('OTP is required')
        .isNumeric().withMessage('OTP must be numeric')
        .isLength({ min: 4, max: 6 }).withMessage('OTP must be 4–6 digits'),
    validate,
];

/** Password Reset - Validate email */
module.exports.validatePasswordReset = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Enter a valid email address')
        .normalizeEmail(),
    validate,
];

/** New Password - Validate strength */
module.exports.validateNewPassword = [
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number'),
    validate,
];
