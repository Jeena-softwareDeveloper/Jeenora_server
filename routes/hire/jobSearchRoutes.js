const express = require('express');
const router = express.Router();
const searchJobController = require('../../controllers/hire/searchJobController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// Public Search (or could be protected if needed, usually search is public)
// Adding authMiddleware optional if you want to personalize based on user, but prompt implies general search.
// "Step 1: Click "Apply" -> Check user credits" implies Apply is protected. Search might be public.
const savedJobController = require('../../controllers/hire/savedJobController');

// Public Search
router.get('/', searchJobController.getJobs); // GET /api/hire/jobs

// Saved Jobs (Protected)
router.post('/save', authMiddleware, savedJobController.toggleSaveJob); // POST /api/hire/jobs/save
router.get('/saved', authMiddleware, savedJobController.getSavedJobs); // GET /api/hire/jobs/saved

router.get('/:id', searchJobController.getJobById); // GET /api/hire/jobs/:id

module.exports = router;
