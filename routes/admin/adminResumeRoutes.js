const express = require('express');
const router = express.Router();
const adminResumeController = require('../../controllers/admin/adminResumeController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.get('/', authMiddleware, adminResumeController.getResumes);
router.delete('/:id', authMiddleware, adminResumeController.deleteResume);

module.exports = router;
