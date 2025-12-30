# Email OTP Configuration Guide

## Environment Variables

Add these to your `.env` file:

```env
# Email Configuration for OTP
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your-app-specific-password
```

## Gmail App Password Setup

1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to Security
3. Enable 2-Step Verification (if not already enabled)
4. Go to "App passwords"
5. Select "Mail" and "Other (Custom name)"
6. Enter "Jeenora Hire Backend"
7. Click "Generate"
8. Copy the 16-character password
9. Add it to your `.env` file as `EMAIL_PASSWORD`

## API Endpoints

### 1. Send OTP
**POST** `/api/hire/otp/send`

**Request Body**:
```json
{
  "email": "user@example.com",
  "purpose": "signup"  // or "login" or "password-reset"
}
```

**Response** (Success):
```json
{
  "message": "OTP sent successfully to your email",
  "email": "user@example.com",
  "expiresIn": "10 minutes"
}
```

**Response** (Error):
```json
{
  "error": "User already exists. Please login instead."
}
```

---

### 2. Verify OTP
**POST** `/api/hire/otp/verify`

**Request Body**:
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "purpose": "signup"
}
```

**Response** (Success):
```json
{
  "message": "OTP verified successfully",
  "verified": true
}
```

**Response** (Error):
```json
{
  "error": "Invalid OTP",
  "attemptsLeft": 2
}
```

---

### 3. Resend OTP
**POST** `/api/hire/otp/resend`

**Request Body**:
```json
{
  "email": "user@example.com",
  "purpose": "signup"
}
```

**Response** (Success):
```json
{
  "message": "OTP resent successfully",
  "email": "user@example.com",
  "expiresIn": "10 minutes"
}
```

---

## OTP Features

### Security Features
- ✅ **10-minute expiration** - OTPs automatically expire
- ✅ **3 attempt limit** - Maximum 3 verification attempts per OTP
- ✅ **Auto-deletion** - Expired OTPs are automatically removed from database
- ✅ **One-time use** - OTPs can only be verified once
- ✅ **Email validation** - Checks if user exists for login, doesn't exist for signup

### Email Template
- Professional HTML email design
- Jeenora Hire branding
- Clear OTP display with large font
- Expiration time clearly mentioned
- Security warnings included
- Responsive design

---

## Integration Flow

### Signup Flow
```
1. User enters email
2. Frontend calls /api/hire/otp/send with purpose="signup"
3. User receives OTP email
4. User enters OTP
5. Frontend calls /api/hire/otp/verify
6. If verified, proceed with signup
```

### Login Flow
```
1. User enters email
2. Frontend calls /api/hire/otp/send with purpose="login"
3. User receives OTP email
4. User enters OTP
5. Frontend calls /api/hire/otp/verify
6. If verified, proceed with login
```

---

## Error Handling

### Common Errors

**User Not Found (Login)**:
```json
{
  "error": "User not found. Please sign up first."
}
```

**User Already Exists (Signup)**:
```json
{
  "error": "User already exists. Please login instead."
}
```

**OTP Expired**:
```json
{
  "error": "OTP has expired. Please request a new one."
}
```

**Too Many Attempts**:
```json
{
  "error": "Too many failed attempts. Please request a new OTP."
}
```

**Invalid OTP**:
```json
{
  "error": "Invalid OTP",
  "attemptsLeft": 2
}
```

---

## Database Schema

### OTP Model
```javascript
{
  email: String,          // User email
  otp: String,            // 6-digit OTP
  purpose: String,        // 'signup', 'login', 'password-reset'
  verified: Boolean,      // Verification status
  expiresAt: Date,        // Expiration timestamp
  attempts: Number,       // Failed verification attempts
  createdAt: Date,        // Auto-generated
  updatedAt: Date         // Auto-generated
}
```

### Indexes
- `expiresAt` - For automatic deletion
- `email + purpose` - For faster queries

---

## Testing

### Test with Postman

1. **Send OTP**:
   ```
   POST http://localhost:5000/api/hire/otp/send
   Body: { "email": "test@example.com", "purpose": "signup" }
   ```

2. **Check Email** - You should receive an OTP

3. **Verify OTP**:
   ```
   POST http://localhost:5000/api/hire/otp/verify
   Body: { "email": "test@example.com", "otp": "123456", "purpose": "signup" }
   ```

4. **Resend OTP**:
   ```
   POST http://localhost:5000/api/hire/otp/resend
   Body: { "email": "test@example.com", "purpose": "signup" }
   ```

---

## Production Checklist

- [ ] Add EMAIL_USER to production environment variables
- [ ] Add EMAIL_PASSWORD to production environment variables
- [ ] Test email delivery in production
- [ ] Monitor OTP delivery rates
- [ ] Set up email sending limits
- [ ] Configure email service provider (Gmail, SendGrid, etc.)
- [ ] Add rate limiting for OTP requests
- [ ] Set up monitoring for failed email deliveries

---

**Created**: December 30, 2025  
**Status**: ✅ Ready for Integration  
**Version**: 1.0
