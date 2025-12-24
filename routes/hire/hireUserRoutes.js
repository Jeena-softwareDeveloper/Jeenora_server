// routes/hireUserRoutes.js
const express = require('express');
const router = express.Router();
const hireUserController = require('../../controllers/hire/hireUserController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// Profile CRUD

// Profile CRUD
router.post('/profile', authMiddleware, hireUserController.createProfile); // #swagger.tags = ['Hire Profile']
router.get('/profile', authMiddleware, hireUserController.getProfile); // #swagger.tags = ['Hire Profile']
router.put('/profile', authMiddleware, hireUserController.updateProfile); // #swagger.tags = ['Hire Profile']
router.delete('/profile', authMiddleware, hireUserController.deleteProfile); // #swagger.tags = ['Hire Profile']

router.get('/profile/check', authMiddleware, hireUserController.checkProfileStatus); // #swagger.tags = ['Hire Profile']
router.put('/profile/preferences', authMiddleware, hireUserController.updatePreferences); // #swagger.tags = ['Hire Profile']


// Profile Image
router.post('/profile/image', authMiddleware, hireUserController.uploadProfileImage); // #swagger.tags = ['Hire Profile']
router.delete('/profile/image', authMiddleware, hireUserController.deleteProfileImage); // #swagger.tags = ['Hire Profile']

// Resume

// Resume
router.post('/profile/resume', authMiddleware, hireUserController.uploadResume); // #swagger.tags = ['Hire Profile']
router.delete('/profile/resume', authMiddleware, hireUserController.deleteResume); // #swagger.tags = ['Hire Profile']

router.post('/profile/resume/analysis', authMiddleware, hireUserController.analyzeResume); // #swagger.tags = ['Hire Profile']
router.get('/profile/resumes', authMiddleware, hireUserController.getResumeVersions); // #swagger.tags = ['Hire Profile']
router.post('/profile/resume/version', authMiddleware, hireUserController.addResumeVersion); // #swagger.tags = ['Hire Profile']


// Skills
router.get('/skills', authMiddleware, hireUserController.getUserSkills); // #swagger.tags = ['Hire Profile']

// Admin User Management
router.get('/admin/users', authMiddleware, hireUserController.getAllUsers);
router.post('/admin/users', authMiddleware, hireUserController.createUserByAdmin);
router.put('/admin/users/:userId', authMiddleware, hireUserController.updateUserByAdmin);
router.delete('/admin/users/:userId', authMiddleware, hireUserController.deleteUserByAdmin);

module.exports = router;