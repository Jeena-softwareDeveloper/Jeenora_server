const express = require('express');
const router = express.Router();
const adminApplicationController = require('../../controllers/admin/adminApplicationController');
const { authMiddleware } = require('../../middlewares/authMiddleware'); // Assuming admin middleware exists or is part of auth

router.put('/:id/status', authMiddleware, adminApplicationController.update_application_status);

module.exports = router;
