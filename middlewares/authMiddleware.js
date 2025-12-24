// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

module.exports.authMiddleware = async (req, res, next) => {
    try {
        // Check for token in multiple locations
        let token = req.headers.authorization?.replace('Bearer ', '') ||
            req.headers['x-access-token'] ||
            req.cookies.accessToken;

        if (!token) {
            return res.status(401).json({ error: 'Please login first' });
        }

        const deCodeToken = await jwt.verify(token, process.env.SECRET);

        // Add user info to request
        req.role = deCodeToken.role;
        req.id = deCodeToken.id;
        req.user = deCodeToken; // Add full user info

        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired, please login again' });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        } else {
            return res.status(500).json({ error: 'Authentication failed' });
        }
    }
}