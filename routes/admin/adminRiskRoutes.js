const express = require('express');
const router = express.Router();
const adminRiskController = require('../../controllers/admin/adminRiskController');
const adminSecurityController = require('../../controllers/admin/adminSecurityController');
const { authMiddleware, adminMiddleware } = require('../../middlewares/authMiddleware');

// Risk Routes
router.get('/report', authMiddleware, adminMiddleware, adminRiskController.get_risk_report);
router.get('/suspicious-logins', authMiddleware, adminMiddleware, adminRiskController.get_suspicious_logins);
router.post('/disable-cod/:userId', authMiddleware, adminMiddleware, adminRiskController.disable_cod);

// Security Routes
router.post('/force-logout/:userId', authMiddleware, adminMiddleware, adminSecurityController.force_logout);
router.post('/global-force-logout', authMiddleware, adminMiddleware, adminSecurityController.global_force_logout);

module.exports = router;
