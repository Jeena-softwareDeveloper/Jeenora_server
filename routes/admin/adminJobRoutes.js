const express = require('express');
const router = express.Router();
const adminJobController = require('../../controllers/admin/adminJobController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// Base path: /api/admin/jobs

// Standard CRUD
router.post('/', authMiddleware, adminJobController.createJob);
router.get('/', authMiddleware, adminJobController.getJobs);
router.get('/:id', authMiddleware, adminJobController.getJobById);
router.put('/:id', authMiddleware, adminJobController.updateJob);
router.delete('/:id', authMiddleware, adminJobController.deleteJob);
router.get('/:id/applications', authMiddleware, adminJobController.getJobApplications);

// Specific Actions
router.post('/:id/pause', authMiddleware, adminJobController.pauseJob);

module.exports = router;
