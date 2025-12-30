const express = require('express');
const router = express.Router();
const passwordResetController = require('../../controllers/hire/passwordResetController');

// Password reset routes
router.post('/send-link', passwordResetController.sendResetLink);
router.get('/verify-token', passwordResetController.verifyResetToken);
router.post('/reset', passwordResetController.resetPassword);

module.exports = router;
