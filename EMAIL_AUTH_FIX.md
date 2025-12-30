# Email Authentication Error - Fix Guide

## ❌ Current Error
```
Error: Missing credentials for "PLAIN"
code: 'EAUTH'
```

## 🔧 Solution Steps

### Option 1: Use Gmail App Password (Recommended)

1. **Go to Google Account Security**
   - Visit: https://myaccount.google.com/security

2. **Enable 2-Step Verification**
   - Click "2-Step Verification"
   - Follow the setup process

3. **Generate App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "Jeenora Hire Backend"
   - Click "Generate"
   - Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

4. **Update .env File**
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=abcdefghijklmnop  # 16-char app password (no spaces)
   ```

5. **Restart Backend**
   ```bash
   npm start
   ```

---

### Option 2: Enable Less Secure Apps (Not Recommended)

⚠️ **Warning**: This is less secure. Use App Password instead.

1. Go to: https://myaccount.google.com/lesssecureapps
2. Turn ON "Allow less secure apps"
3. Use your regular Gmail password in `.env`

---

### Option 3: Use Different Email Service

If Gmail doesn't work, you can use other services:

#### Using SendGrid (Free tier available)
```javascript
// In emailService.js
const transporter = nodemailer.createTransport({
    host: 'smtp.sendgrid.net',
    port: 587,
    auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
    }
});
```

#### Using Mailgun
```javascript
const transporter = nodemailer.createTransport({
    host: 'smtp.mailgun.org',
    port: 587,
    auth: {
        user: process.env.MAILGUN_USER,
        pass: process.env.MAILGUN_PASSWORD
    }
});
```

---

## ✅ Current .env Configuration

Your `.env` file now has:
```env
EMAIL_USER=jeena2284@gmail.com
EMAIL_PASSWORD=mekvnzjtcgwshmsi
```

**Next Steps**:
1. Verify the password `mekvnzjtcgwshmsi` is correct
2. If it's a regular password, generate App Password instead
3. Update `EMAIL_PASSWORD` with the new App Password
4. Restart backend server

---

## 🧪 Test Email Sending

After fixing credentials, test with:

```bash
# Using Postman or curl
POST http://localhost:5000/api/hire/otp/send
Content-Type: application/json

{
  "email": "test@example.com",
  "purpose": "signup"
}
```

---

## 📝 Troubleshooting

### Error: "Invalid login"
- ✅ Check email address is correct
- ✅ Verify App Password is 16 characters
- ✅ Remove any spaces from App Password
- ✅ Ensure 2-Step Verification is enabled

### Error: "Username and Password not accepted"
- ✅ Generate new App Password
- ✅ Try enabling "Less secure app access"
- ✅ Check if account has been locked

### Email not received
- ✅ Check spam folder
- ✅ Verify email address is correct
- ✅ Check backend logs for errors
- ✅ Try sending to different email

---

## 🔐 Security Best Practices

1. ✅ **Always use App Passwords** - Never use your main Gmail password
2. ✅ **Keep .env secure** - Never commit to Git
3. ✅ **Rotate passwords** - Change App Passwords periodically
4. ✅ **Use environment variables** - Never hardcode credentials
5. ✅ **Monitor usage** - Check Google account activity regularly

---

**Status**: ⚠️ Email credentials need to be updated  
**Action Required**: Generate Gmail App Password  
**Last Updated**: December 30, 2025
