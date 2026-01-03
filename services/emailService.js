const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Generate 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
const sendOTPEmail = async (email, otp, purpose, resetToken = null) => {
    const purposeText = {
        'signup': 'Sign Up',
        'login': 'Login',
        'password-reset': 'Password Reset',
        'reset-link': 'Reset Password Link'
    };

    // Case 1: Send Reset Link (AFTER OTP Verification)
    if (purpose === 'reset-link' && resetToken) {
        // Use FRONTEND_URL from env, or fall back to local only if not in production
        const frontendBaseUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://hire.jeenora.com' : 'http://localhost:5173');
        const resetLink = `${frontendBaseUrl}/hire/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

        const mailOptions = {
            from: `"Jeenora Hire" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Reset Your Password - Jeenora Hire`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Outfit', Arial, sans-serif; background-color: #f0f2f5; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #065f46 0%, #047857 100%); padding: 40px 20px; text-align: center; }
                        .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 800; }
                        .content { padding: 40px 30px; }
                        .reset-button { display: inline-block; background: #065f46; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; margin: 20px 0; }
                        .reset-button:hover { background: #047857; }
                        .info { background: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 8px; }
                        .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
                        .warning { color: #dc2626; font-weight: 600; margin-top: 20px; font-size: 13px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🚀 Jeenora Hire</h1>
                        </div>
                        <div class="content">
                            <h2 style="color: #1f2937; margin-top: 0;">Reset Your Password</h2>
                            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                                You have successfully verified your identity. Click the button below to reset your password:
                            </p>
                            
                            <div style="text-align: center;">
                                <a href="${resetLink}" class="reset-button">Reset Password</a>
                            </div>

                            <div class="info">
                                <p style="margin: 0; color: #1e40af; font-size: 14px;">
                                    <strong>⏰ Time Sensitive:</strong> This link will expire in 2 minutes.
                                </p>
                            </div>

                            <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
                                If the button doesn't work, copy and paste this link:
                            </p>
                            <p style="color: #2563eb; font-size: 12px; word-break: break-all;">
                                ${resetLink}
                            </p>
                        </div>
                        <div class="footer">
                            <p style="margin: 0;">© ${new Date().getFullYear()} Jeenora Hire. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            return { success: true };
        } catch (error) {
            console.error('Email send error:', error);
            return { success: false, error: error.message };
        }
    }

    // Case 2: Send OTP (Signup, Login, Password Reset Request)
    const mailOptions = {
        from: `"Jeenora Hire" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Your ${purposeText[purpose]} OTP - Jeenora Hire`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Outfit', Arial, sans-serif; background-color: #f0f2f5; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    .header { background: linear-gradient(135deg, #065f46 0%, #047857 100%); padding: 40px 20px; text-align: center; }
                    .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 800; }
                    .content { padding: 40px 30px; }
                    .otp-box { background: #f0fdf4; border: 2px solid #065f46; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
                    .otp-code { font-size: 42px; font-weight: 900; color: #065f46; letter-spacing: 8px; margin: 10px 0; }
                    .info { background: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 8px; }
                    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
                    .warning { color: #dc2626; font-weight: 600; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚀 Jeenora Hire</h1>
                    </div>
                    <div class="content">
                        <h2 style="color: #1f2937; margin-top: 0;">Your ${purposeText[purpose]} OTP</h2>
                        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                            Hello! You requested an OTP for ${purposeText[purpose]?.toLowerCase() || 'verification'} on Jeenora Hire. 
                            Please use the following code to complete your verification:
                        </p>
                        
                        <div class="otp-box">
                            <p style="margin: 0; color: #065f46; font-weight: 600; font-size: 14px;">YOUR OTP CODE</p>
                            <div class="otp-code">${otp}</div>
                            <p style="margin: 0; color: #6b7280; font-size: 13px; margin-top: 10px;">Valid for 2 minutes</p>
                        </div>

                        <div class="info">
                            <p style="margin: 0; color: #1e40af; font-size: 14px;">
                                <strong>⏰ Time Sensitive:</strong> This OTP will expire in 2 minutes for security reasons.
                            </p>
                        </div>

                        <p class="warning" style="font-size: 13px;">
                            ⚠️ Never share this OTP with anyone. Jeenora Hire will never ask for your OTP.
                        </p>
                    </div>
                    <div class="footer">
                        <p style="margin: 0;">© ${new Date().getFullYear()} Jeenora Hire. All rights reserved.</p>
                        <p style="margin: 10px 0 0 0;">Need help? Contact us at support@jeenorahire.com</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('Email send error:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    generateOTP,
    sendOTPEmail
};
