const bcrypt = require('bcrypt');
const { createToken } = require('../../utiles/tokenCreate');
const HireUser = require('../../models/hire/hireUserModel');

const hireAuthController = {
    // Register
    register: async (req, res) => {
        try {
            const { name, email, phone, password } = req.body;

            if (!name || !email || !phone || !password) {
                return res.status(400).json({ success: false, error: "Please provide all fields" });
            }

            const existingUser = await HireUser.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ success: false, error: "Email already exists" });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const user = await HireUser.create({
                name,
                email,
                phone,
                password: hashedPassword
            });

            const token = await createToken({ id: user._id, role: user.role });

            res.status(201).json({
                success: true,
                message: "Hire user registered successfully",
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // Login
    login: async (req, res) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ success: false, error: "Please provide email and password" });
            }

            const user = await HireUser.findOne({ email }).select('+password');
            if (!user) {
                return res.status(404).json({ success: false, error: "User not found" });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ success: false, error: "Invalid credentials" });
            }

            const token = await createToken({ id: user._id, role: user.role });

            res.status(200).json({
                success: true,
                message: "Login successful",
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // Social Login
    socialLogin: async (req, res) => {
        try {
            const { provider, email, name, image } = req.body;
            // Simplified social login: Trusting client for now (In prod, verify token with provider)

            let user = await HireUser.findOne({ email });

            if (!user) {
                user = await HireUser.create({
                    name,
                    email,
                    phone: "", // Optional or prompt later
                    password: await bcrypt.hash(email + process.env.SECRET, 10), // Dummy password
                    profileImageUrl: image,
                    profileCompleted: false
                });
            }

            const token = await createToken({ id: user._id, role: user.role });

            res.status(200).json({
                success: true,
                message: `Logged in with ${provider}`,
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // 2FA Setup
    setup2FA: async (req, res) => {
        try {
            // Placeholder: Use a library like 'speakeasy' and 'qrcode'
            res.status(200).json({
                success: true,
                secret: "TEMPORARY_SECRET_KEY",
                qrCode: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA..."
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // 2FA Verify
    verify2FA: async (req, res) => {
        try {
            const { token } = req.body;
            // Placeholder validation
            if (token === "123456") {
                res.status(200).json({ success: true, message: "2FA verified" });
            } else {
                res.status(400).json({ success: false, message: "Invalid code" });
            }
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

module.exports = hireAuthController;
