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
            from: `"Jeenora Wear Support" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            text: message,
            headers: {
                'List-Unsubscribe': `<mailto:${process.env.EMAIL_USER}?subject=unsubscribe>`,
                'Precedence': 'bulk'
            },
            html: html || `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #a31545 0%, #720d2e 100%); padding: 35px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 26px; letter-spacing: 3px; font-weight: 800;">JEENORA WEAR</h1>
          </div>
          <div style="padding: 40px 30px; background: #ffffff;">
            <h2 style="color: #2d3436; margin-top: 0; font-size: 20px;">Business Update</h2>
            <p style="font-size: 16px; line-height: 1.7; color: #636e72;">${message}</p>
            
            <div style="margin-top: 40px; padding: 25px; background: #fdf2f5; border-left: 4px solid #a31545; border-radius: 8px;">
              <p style="margin: 0; color: #a31545; font-size: 13px; font-weight: 600;">System Notification</p>
              <p style="margin: 5px 0 0 0; color: #7f8c8d; font-size: 12px;">This update was automatically generated for your supplier account to keep you informed about your dashboard activity.</p>
            </div>
          </div>
          <div style="background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #eee;">
            <p style="margin: 0; font-size: 12px; color: #b2bec3;">&copy; ${new Date().getFullYear()} Jeenora Wear. All rights reserved.</p>
            <p style="margin: 10px 0 0 0; font-size: 11px; color: #b2bec3; line-height: 1.5;">
              Jeenora Headquarters, Industrial Estate, Tamil Nadu, India<br/>
              To stop receiving these reports, <a href="#" style="color: #a31545; text-decoration: underline;">unsubscribe here</a>
            </p>
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
