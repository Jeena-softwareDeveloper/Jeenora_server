const nodemailer = require('nodemailer');

// Email transporter configuration
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

/**
 * Generic function to send email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} message - Plain text message
 * @param {string} html - Optional HTML content
 */
const sendEmail = async (to, subject, message, html = null) => {
    try {
        if (!to) {
            console.log('No email address provided');
            return false;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            console.log(`[EmailSender] Invalid email syntax skipped: ${to}`);
            return false;
        }

        const mailOptions = {
            from: `Jeenora Wear <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            text: message,
            html: html || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 10px; overflow: hidden;">
          <div style="background: #a31545; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: 2px;">JEENORA WEAR</h1>
          </div>
          <div style="padding: 30px; background: #ffffff;">
            <h2 style="color: #333; margin-top: 0;">New Promotional Alert!</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #555;">${message}</p>
            <div style="margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;">
              <p style="margin: 0; color: #888; font-size: 12px;">This is an automated notification from the Jeenora Wear Administration.</p>
              <p style="margin: 5px 0 0 0; color: #888; font-size: 12px;">Please check your supplier dashboard for more details.</p>
            </div>
          </div>
          <div style="background: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #aaa;">
            &copy; ${new Date().getFullYear()} Jeenora. All rights reserved.
          </div>
        </div>
      `
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${to}`);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

module.exports = { sendEmail };
