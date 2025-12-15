const nodemailer = require('nodemailer');
const HireUser = require('../../../models/hire/hireUserModel');

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.sendEmail = async (userId, subject, message, html = null) => {
  try {
    const user = await HireUser.findById(userId).select('email name');
    if (!user || !user.email) {
      console.log('User not found or no email address');
      return false;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: `JEENORA HIRE - ${subject}`,
      text: message,
      html: html || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">JEENORA HIRE</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <h2>Hello ${user.name},</h2>
            <p style="font-size: 16px; line-height: 1.6;">${message}</p>
            <div style="margin-top: 30px; padding: 15px; background: white; border-radius: 5px;">
              <p style="margin: 0; color: #666;">This is an automated notification from JEENORA HIRE.</p>
            </div>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${user.email}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};