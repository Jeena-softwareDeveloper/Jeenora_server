const OTP = require('../../models/hire/otpModel');
const HireUser = require('../../models/hire/hireUserModel');
const { generateOTP, sendOTPEmail } = require('../../services/emailService');

// Helper to send or reuse OTP
const handleOTPSending = async (email, purpose, res) => {
    // Check for existing valid OTP (not expired)
    let otpRecord = await OTP.findOne({
        email,
        purpose,
        expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    let otp;
    let isNew = false;

    if (otpRecord) {
        // REUSE EXISTING OTP
        otp = otpRecord.otp;

        // Update lastSentAt and increment resendCount
        otpRecord.lastSentAt = Date.now();
        otpRecord.resendCount += 1;
        await otpRecord.save();
    } else {
        // GENERATE NEW OTP
        otp = generateOTP();
        isNew = true;

        // Create new record
        otpRecord = await OTP.create({
            email,
            otp,
            purpose,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
            lastSentAt: Date.now(),
            resendCount: 0
        });
    }

    // Send email
    const emailResult = await sendOTPEmail(email, otp, purpose);

    if (!emailResult.success) {
        return res.status(500).json({ error: 'Failed to send OTP email' });
    }

    res.status(200).json({
        message: isNew ? 'OTP sent successfully' : 'OTP resent successfully',
        email,
        expiresIn: '10 minutes',
        resendCount: otpRecord.resendCount
    });
};

// Send OTP for signup/login
exports.sendOTP = async (req, res) => {
    try {
        const { email, purpose } = req.body;

        if (!email || !purpose) {
            return res.status(400).json({ error: 'Email and purpose are required' });
        }

        if (!['signup', 'login', 'password-reset'].includes(purpose)) {
            return res.status(400).json({ error: 'Invalid purpose' });
        }

        // For login, check if user exists
        if (purpose === 'login') {
            const userExists = await HireUser.findOne({ email });
            if (!userExists) {
                return res.status(404).json({ error: 'User not found. Please sign up first.' });
            }
        }

        // For signup, check if user already exists
        if (purpose === 'signup') {
            const userExists = await HireUser.findOne({ email });
            if (userExists) {
                return res.status(400).json({ error: 'User already exists. Please login instead.' });
            }
        }

        // For password reset, check if user exists
        if (purpose === 'password-reset') {
            const userExists = await HireUser.findOne({ email });
            if (!userExists) {
                return res.status(404).json({ error: 'User not found with this email.' });
            }
        }

        await handleOTPSending(email, purpose, res);

    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp, purpose } = req.body;

        if (!email || !otp || !purpose) {
            return res.status(400).json({ error: 'Email, OTP, and purpose are required' });
        }

        // Find OTP
        const otpRecord = await OTP.findOne({
            email,
            purpose,
            verified: false
        }).sort({ createdAt: -1 });

        if (!otpRecord) {
            return res.status(404).json({ error: 'OTP not found or already verified' });
        }

        // Check if OTP is expired
        if (new Date() > otpRecord.expiresAt) {
            // Don't delete immediately, keep history, but it's invalid
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        // Check attempts (Max 5 attempts allowed)
        if (otpRecord.attempts >= 5) {
            return res.status(400).json({
                error: 'Too many failed attempts. Please request a new OTP.',
                resendRequired: true
            });
        }

        // Verify OTP
        if (otpRecord.otp !== otp) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            return res.status(400).json({
                error: 'Invalid OTP',
                attemptsLeft: 5 - otpRecord.attempts
            });
        }

        // Mark as verified
        otpRecord.verified = true;
        await otpRecord.save();

        res.status(200).json({
            message: 'OTP verified successfully',
            verified: true
        });

    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
};

// Resend OTP
exports.resendOTP = async (req, res) => {
    try {
        const { email, purpose } = req.body;

        if (!email || !purpose) {
            return res.status(400).json({ error: 'Email and purpose are required' });
        }

        await handleOTPSending(email, purpose, res);

    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ error: 'Failed to resend OTP' });
    }
};
