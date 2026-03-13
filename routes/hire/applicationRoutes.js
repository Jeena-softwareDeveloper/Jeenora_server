const express = require('express');
const router = express.Router();
const applicationController = require('../../controllers/hire/applicationController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.post('/', authMiddleware, applicationController.applyForJob); // POST /api/hire/applications
router.get('/my', authMiddleware, applicationController.getUserApplications); // GET /api/hire/applications/my
router.get('/stats', authMiddleware, applicationController.getApplicationStats); // GET /api/hire/applications/stats
router.put('/:id/notes', authMiddleware, applicationController.updateNote); // PUT /api/hire/applications/:id/notes
router.post('/:id/withdraw', authMiddleware, applicationController.withdrawApplication); // POST /api/hire/applications/:id/withdraw
router.post('/:id/enable-chat', authMiddleware, applicationController.enableChat); // POST /api/hire/applications/:id/enable-chat

const jobMessageController = require('../../controllers/hire/jobMessageController');

router.post('/message', authMiddleware, jobMessageController.sendMessage);
router.get('/message/:applicationId', authMiddleware, jobMessageController.getMessages);
router.put('/message/read', authMiddleware, jobMessageController.markAsRead);

module.exports = router;
