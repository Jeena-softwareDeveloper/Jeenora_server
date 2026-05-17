const Supplier = require('../../models/partner/Supplier');
const { responseReturn } = require('../../utils/response');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class SecurityController {
    
    // ==================== SESSION MANAGEMENT ====================
    
    // 1. Get active sessions
    get_active_sessions = async (req, res) => {
        const { id } = req; // user ID
        
        try {
            const user = await Supplier.findById(id);
            if (!user) {
                return responseReturn(res, 404, { error: 'User not found' });
            }
            
            // Mock active sessions
            const activeSessions = [
                {
                    sessionId: 'session_001',
                    device: 'Chrome on Windows',
                    ip: '192.168.1.100',
                    location: 'Chennai, India',
                    lastActive: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
                    current: true
                },
                {
                    sessionId: 'session_002',
                    device: 'Safari on iPhone',
                    ip: '103.45.67.89',
                    location: 'Bangalore, India',
                    lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
                    current: false
                },
                {
                    sessionId: 'session_003',
                    device: 'Firefox on Mac',
                    ip: '45.67.89.123',
                    location: 'Mumbai, India',
                    lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
                    current: false
                }
            ];
            
            responseReturn(res, 200, {
                success: true,
                sessions: activeSessions,
                summary: {
                    total: activeSessions.length,
                    current: activeSessions.filter(s => s.current).length,
                    recent: activeSessions.filter(s => 
                        Date.now() - new Date(s.lastActive).getTime() < 24 * 60 * 60 * 1000
                    ).length
                }
            });
            
        } catch (error) {
            console.error('Get Active Sessions Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 2. Terminate session
    terminate_session = async (req, res) => {
        const { id } = req;
        const { sessionId } = req.params;
        
        try {
            const user = await Supplier.findById(id);
            if (!user) {
                return responseReturn(res, 404, { error: 'User not found' });
            }
            
            // In a real system, invalidate session token
            // For now, return success
            
            responseReturn(res, 200, {
                success: true,
                message: 'Session terminated successfully',
                sessionId,
                terminatedAt: new Date()
            });
            
        } catch (error) {
            console.error('Terminate Session Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 3. Terminate all other sessions
    terminate_all_other_sessions = async (req, res) => {
        const { id } = req;
        
        try {
            const user = await Supplier.findById(id);
            if (!user) {
                return responseReturn(res, 404, { error: 'User not found' });
            }
            
            // In a real system, invalidate all other session tokens
            // For now, return success
            
            responseReturn(res, 200, {
                success: true,
                message: 'All other sessions terminated successfully',
                terminatedCount: 2, // Mock count
                terminatedAt: new Date(),
                currentSession: {
                    sessionId: 'session_001',
                    device: 'Chrome on Windows',
                    ip: '192.168.1.100',
                    location: 'Chennai, India'
                }
            });
            
        } catch (error) {
            console.error('Terminate All Other Sessions Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // ==================== PASSWORD MANAGEMENT ====================
    
    // 4. Change password
    change_password = async (req, res) => {
        const { id } = req;
        const { currentPassword, newPassword, confirmPassword } = req.body;
        
        try {
            const user = await Supplier.findById(id);
            if (!user) {
                return responseReturn(res, 404, { error: 'User not found' });
            }
            
            // Validate inputs
            if (!currentPassword || !newPassword || !confirmPassword) {
                return responseReturn(res, 400, { error: 'All password fields are required' });
            }
            
            if (newPassword !== confirmPassword) {
                return responseReturn(res, 400, { error: 'New password and confirmation do not match' });
            }
            
            if (newPassword.length < 8) {
                return responseReturn(res, 400, { error: 'Password must be at least 8 characters long' });
            }
            
            // Check if new password is same as current
            if (currentPassword === newPassword) {
                return responseReturn(res, 400, { error: 'New password must be different from current password' });
            }
            
            // In a real system, verify current password
            // For now, simulate verification
            
            const passwordValid = true; // Mock validation
            
            if (!passwordValid) {
                return responseReturn(res, 400, { error: 'Current password is incorrect' });
            }
            
            // Update password (in real system, hash and save)
            user.passwordUpdatedAt = new Date();
            
            responseReturn(res, 200, {
                success: true,
                message: 'Password changed successfully',
                changedAt: new Date(),
                nextSteps: 'You will be logged out of all other devices'
            });
            
        } catch (error) {
            console.error('Change Password Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 5. Get password strength
    get_password_strength = async (req, res) => {
        const { password } = req.query;
        
        try {
            if (!password) {
                return responseReturn(res, 400, { error: 'Password is required' });
            }
            
            // Calculate password strength
            let score = 0;
            const feedback = [];
            
            // Length check
            if (password.length >= 8) score += 1;
            if (password.length >= 12) score += 1;
            
            // Complexity checks
            if (/[A-Z]/.test(password)) score += 1; // Uppercase
            if (/[a-z]/.test(password)) score += 1; // Lowercase
            if (/[0-9]/.test(password)) score += 1; // Numbers
            if (/[^A-Za-z0-9]/.test(password)) score += 1; // Special characters
            
            // Common password check
            const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'welcome'];
            if (commonPasswords.includes(password.toLowerCase())) {
                score = 0;
                feedback.push('Password is too common');
            }
            
            // Sequential characters check
            if (/(.)\1{2,}/.test(password)) {
                score -= 1;
                feedback.push('Avoid repeating characters');
            }
            
            // Determine strength level
            let strength;
            if (score <= 2) strength = 'weak';
            else if (score <= 4) strength = 'medium';
            else if (score <= 6) strength = 'strong';
            else strength = 'very strong';
            
            // Generate suggestions
            const suggestions = [];
            if (password.length < 8) suggestions.push('Use at least 8 characters');
            if (!/[A-Z]/.test(password)) suggestions.push('Add uppercase letters');
            if (!/[0-9]/.test(password)) suggestions.push('Add numbers');
            if (!/[^A-Za-z0-9]/.test(password)) suggestions.push('Add special characters');
            
            responseReturn(res, 200, {
                success: true,
                strength: {
                    score,
                    level: strength,
                    feedback,
                    suggestions
                }
            });
            
        } catch (error) {
            console.error('Get Password Strength Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // ==================== TWO-FACTOR AUTHENTICATION ====================
    
    // 6. Get 2FA status
    get_2fa_status = async (req, res) => {
        const { id } = req;
        
        try {
            const user = await Supplier.findById(id);
            if (!user) {
                return responseReturn(res, 404, { error: 'User not found' });
            }
            
            // Mock 2FA status
            const twoFactorStatus = {
                enabled: true,
                method: 'authenticator_app', // 'sms', 'email', 'authenticator_app'
                lastUsed: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
                backupCodes: {
                    available: 5,
                    total: 10,
                    generatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
                },
                devices: [
                    {
                        name: 'iPhone 13',
                        lastUsed: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                        trusted: true
                    },
                    {
                        name: 'Windows Laptop',
                        lastUsed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                        trusted: true
                    }
                ]
            };
            
            responseReturn(res, 200, {
                success: true,
                twoFactor: twoFactorStatus
            });
            
        } catch (error) {
            console.error('Get 2FA Status Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 7. Enable 2FA
    enable_2fa = async (req, res) => {
        const { id } = req;
        const { method = 'authenticator_app', phoneNumber, email } = req.body;
        
        try {
            const user = await Supplier.findById(id);
            if (!user) {
                return responseReturn(res, 404, { error: 'User not found' });
            }
            
            // Validate method
            const validMethods = ['sms', 'email', 'authenticator_app'];
            if (!validMethods.includes(method)) {
                return responseReturn(res, 400, { 
                    error: `Invalid method. Valid methods: ${validMethods.join(', ')}` 
                });
            }
            
            // Generate secret for authenticator app
            let secret;
            let qrCodeUrl;
            
            if (method === 'authenticator_app') {
                secret = crypto.randomBytes(20).toString('hex');
                qrCodeUrl = `otpauth://totp/Jeenora:${user.email}?secret=${secret}&issuer=Jeenora`;
            }
            
            // Generate backup codes
            const backupCodes = Array.from({ length: 10 }, () => 
                crypto.randomBytes(4).toString('hex').toUpperCase()
            );
            
            responseReturn(res, 200, {
                success: true,
                message: 'Two-factor authentication setup initiated',
                setup: {
                    method,
                    secret: method === 'authenticator_app' ? secret : undefined,
                    qrCodeUrl: method === 'authenticator_app' ? qrCodeUrl : undefined,
                    phoneNumber: method === 'sms' ? phoneNumber : undefined,
                    email: method === 'email' ? email : undefined,
                    backupCodes,
                    nextSteps: this.get2FASetupSteps(method)
                }
            });
            
        } catch (error) {
            console.error('Enable 2FA Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 8. Disable 2FA
    disable_2fa = async (req, res) => {
        const { id } = req;
        const { password, reason } = req.body;
        
        try {
            const user = await Supplier.findById(id);
            if (!user) {
                return responseReturn(res, 404, { error: 'User not found' });
            }
            
            if (!password) {
                return responseReturn(res, 400, { error: 'Password is required to disable 2FA' });
            }
            
            // In a real system, verify password
            // For now, simulate verification
            
            const passwordValid = true; // Mock validation
            
            if (!passwordValid) {
                return responseReturn(res, 400, { error: 'Password is incorrect' });
            }
            
            responseReturn(res, 200, {
                success: true,
                message: 'Two-factor authentication disabled successfully',
                disabledAt: new Date(),
                reason: reason || 'User requested',
                securityNote: 'Your account security has been reduced. Consider re-enabling 2FA.'
            });
            
        } catch (error) {
            console.error('Disable 2FA Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // ==================== LOGIN ACTIVITY ====================
    
    // 9. Get login activity
    get_login_activity = async (req, res) => {
        const { id } = req;
        let { 
            page = 1, 
            limit = 20, 
            startDate,
            endDate,
            status 
        } = req.query;
        
        try {
            const user = await Supplier.findById(id);
            if (!user) {
                return responseReturn(res, 404, { error: 'User not found' });
            }
            
            page = parseInt(page);
            limit = parseInt(limit);
            const skip = (page - 1) * limit;
            
            // Mock login activity
            const mockActivity = this.generateMockLoginActivity(id);
            
            // Apply filters
            let filteredActivity = mockActivity;
            
            if (status) {
                filteredActivity = filteredActivity.filter(a => a.status === status);
            }
            
            if (startDate) {
                const start = new Date(startDate);
                filteredActivity = filteredActivity.filter(a => new Date(a.timestamp) >= start);
            }
            
            if (endDate) {
                const end = new Date(endDate);
                filteredActivity = filteredActivity.filter(a => new Date(a.timestamp) <= end);
            }
            
            // Sort by latest first
            filteredActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Paginate
            const total = filteredActivity.length;
            const paginatedActivity = filteredActivity.slice(skip, skip + limit);
            
            // Calculate stats
            const stats = {
                total: filteredActivity.length,
                successful: filteredActivity.filter(a => a.status === 'success').length,
                failed: filteredActivity.filter(a => a.status === 'failed').length,
                suspicious: filteredActivity.filter(a => a.suspicious).length,
                byDevice: this.getActivityByDevice(filteredActivity),
                byLocation: this.getActivityByLocation(filteredActivity)
            };
            
            responseReturn(res, 200, {
                success: true,
                activity: paginatedActivity,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                },
                stats
            });
            
        } catch (error) {
            console.error('Get Login Activity Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // ==================== SECURITY SETTINGS ====================
    
    // 10. Get security settings
    get_security_settings = async (req, res) => {
        const { id } = req;
        
        try {
            const user = await Supplier.findById(id);
            if (!user) {
                return responseReturn(res, 404, { error: 'User not found' });
            }
            
            const securitySettings = {
                password: {
                    minLength: 8,
                    requireUppercase: true,
                    requireLowercase: true,
                    requireNumbers: true,
                    requireSpecialChars: true,
                    expiryDays: 90,
                    historyCount: 5
                },
                session: {
                    timeoutMinutes: 30,
                    maxConcurrentSessions: 5,
                    rememberMeDays: 30
                },
                twoFactor: {
                    required: false,
                    methods: ['authenticator_app', 'sms', 'email'],
                    backupCodesRequired: true
                },
                login: {
                    maxAttempts: 5,
                    lockoutMinutes: 15,
                    notifyOnNewDevice: true,
                    notifyOnFailedLogin: true
                },
                privacy: {
                    showOnlineStatus: true,
                    allowProfileView: true,
                    dataRetentionDays: 365
                }
            };
            
            responseReturn(res, 200, {
                success: true,
                settings: securitySettings
            });
            
        } catch (error) {
            console.error('Get Security Settings Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 11. Update security settings
    update_security_settings = async (req, res) => {
        const { id } = req;
        const { settings } = req.body;
        
        try {
            const user = await Supplier.findById(id);
            if (!user) {
                return responseReturn(res, 404, { error: 'User not found' });
            }
            
            if (!settings || typeof settings !== 'object') {
                return responseReturn(res, 400, { error: 'Invalid settings data' });
            }
            
            // In a real system, validate and save settings
            // For now, return success
            
            responseReturn(res, 200, {
                success: true,
                message: 'Security settings updated successfully',
                settings,
                updatedAt: new Date()
            });
            
        } catch (error) {
            console.error('Update Security Settings Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // ==================== HELPER METHODS ====================
    
    // Helper: Get 2FA setup steps
    get2FASetupSteps = (method) => {
        const steps = {
            authenticator_app: [
                'Download Google Authenticator or similar app',
                'Scan the QR code with the app',
                'Enter the 6-digit code from the app to verify',
                'Save your backup codes in a secure location'
            ],
            sms: [
                'Enter your phone number',
                'Verify your phone number with the code sent via SMS',
                'Save your backup codes in a secure location'
            ],
            email: [
                'Enter your email address',
                'Verify your email with the code sent',
                'Save your backup codes in a secure location'
            ]
        };
        return steps[method] || [];
    };
    
    // Helper: Generate mock login activity
    generateMockLoginActivity = (userId) => {
        const devices = ['Chrome on Windows', 'Safari on iPhone', 'Firefox on Mac', 'Android App', 'iOS App'];
        const locations = ['Chennai, India', 'Bangalore, India', 'Mumbai, India', 'Delhi, India', 'Hyderabad, India'];
        const ips = ['192.168.1.100', '103.45.67.89', '45.67.89.123', '78.90.12.34', '56.78.90.12'];
        const statuses = ['success', 'failed'];
        
        const activity = [];
        
        for (let i = 0; i < 50; i++) {
            const device = devices[Math.floor(Math.random() * devices.length)];
            const location = locations[Math.floor(Math.random() * locations.length)];
            const ip = ips[Math.floor(Math.random() * ips.length)];
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const suspicious = Math.random() > 0.8; // 20% chance of being suspicious
            
            const daysAgo = Math.floor(Math.random() * 30);
            const hoursAgo = Math.floor(Math.random() * 24);
            const timestamp = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 - hoursAgo * 60 * 60 * 1000);
            
            activity.push({
                id: `login_${Date.now() - i * 86400000}`,
                userId,
                device,
                location,
                ip,
                status,
                suspicious,
                timestamp,
                details: status === 'failed' ? 'Invalid password' : 'Successful login'
            });
        }
        
        return activity;
    };
    
    // Helper: Get activity by device
    getActivityByDevice = (activity) => {
        const deviceMap = {};
        
        activity.forEach(a => {
            deviceMap[a.device] = (deviceMap[a.device] || 0) + 1;
        });
        
        return Object.entries(deviceMap).map(([device, count]) => ({
            device,
            count,
            percentage: (count / activity.length) * 100
        })).sort((a, b) => b.count - a.count);
    };
    
    // Helper: Get activity by location
    getActivityByLocation = (activity) => {
        const locationMap = {};
        
        activity.forEach(a => {
            locationMap[a.location] = (locationMap[a.location] || 0) + 1;
        });
        
        return Object.entries(locationMap).map(([location, count]) => ({
            location,
            count,
            percentage: (count / activity.length) * 100
        })).sort((a, b) => b.count - a.count);
    };
}

module.exports = new SecurityController();
