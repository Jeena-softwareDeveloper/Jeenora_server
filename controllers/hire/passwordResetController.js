const HireUser = require('../../models/hire/hireUserModel');
const OTP = require('../../models/hire/otpModel');
const bcrypt = require('bcrypt');
const { sendOTPEmail } = require('../../services/emailService');

// Send Reset Link (After OTP Verification)
exports.sendResetLink = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Verify that OTP was verified recently
        const verifiedOtp = await OTP.findOne({
            email,
            purpose: 'password-reset',
            verified: true
        }).sort({ updatedAt: -1 });

        if (!verifiedOtp) {
            return res.status(400).json({ error: 'Please verify OTP first' });
        }

        // Check if verified recently (within 2 mins)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        if (verifiedOtp.updatedAt < twoMinutesAgo) {
            return res.status(400).json({ error: 'Session expired. Please verify OTP again.' });
        }

        // Generate Reset Token
        const resetToken = require('crypto').randomBytes(32).toString('hex');

        // Create new record for the link (or update)
        // We use 'reset-link' purpose for the link validation
        await OTP.create({
            email,
            otp: 'LINK', // Placeholder
            purpose: 'reset-link',
            resetToken,
            expiresAt: new Date(Date.now() + 2 * 60 * 1000) // 2 minutes
        });

        // Delete the verified OTP to prevent reuse
        await OTP.deleteOne({ _id: verifiedOtp._id });

        // Send Link via Email
        const emailResult = await sendOTPEmail(email, null, 'reset-link', resetToken);

        if (!emailResult.success) {
            return res.status(500).json({ error: 'Failed to send reset link' });
        }

        res.status(200).json({
            message: 'Password reset link sent to your email',
            success: true
        });

    } catch (error) {
        console.error('Send reset link error:', error);
        res.status(500).json({ error: 'Failed to send reset link' });
    }
};

// Verify Reset Token
exports.verifyResetToken = async (req, res) => {
    try {
        const { token, email } = req.query;

        if (!token || !email) {
            return res.status(400).json({ error: 'Token and email are required' });
        }

        // Find record with this token
        // IMPORTANT: purpose is 'reset-link' now
        const otpRecord = await OTP.findOne({
            email,
            resetToken: token,
            purpose: 'reset-link'
        });

        if (!otpRecord) {
            return res.status(400).json({ error: 'Invalid or expired reset link' });
        }

        // Check if expired
        if (new Date() > otpRecord.expiresAt) {
            await OTP.deleteOne({ _id: otpRecord._id });
            return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
        }

        res.status(200).json({
            message: 'Reset link is valid',
            valid: true
        });

    } catch (error) {
        console.error('Verify reset token error:', error);
        res.status(500).json({ error: 'Failed to verify reset link' });
    }
};

// Reset Password
exports.resetPassword = async (req, res) => {
    try {
        const { email, newPassword, token } = req.body;

        if (!email || !newPassword || !token) {
            return res.status(400).json({ error: 'Email, token, and new password are required' });
        }

        // Find record with this token
        const otpRecord = await OTP.findOne({
            email,
            resetToken: token,
            purpose: 'reset-link'
        });

        if (!otpRecord) {
            return res.status(400).json({ error: 'Invalid or expired reset link' });
        }

        // Check if expired
        if (new Date() > otpRecord.expiresAt) {
            await OTP.deleteOne({ _id: otpRecord._id });
            return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
        }

        // Find user
        const user = await HireUser.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Validate password
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        user.password = hashedPassword;
        await user.save();

        // Delete used token
        await OTP.deleteOne({ _id: otpRecord._id });

        res.status(200).json({
            message: 'Password reset successfully',
            success: true
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};
