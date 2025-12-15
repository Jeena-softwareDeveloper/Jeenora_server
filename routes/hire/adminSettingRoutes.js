const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/hire/adminController');
const { authMiddleware } = require('../../middlewares/authMiddleware')

// Admin Settings Routes
router.route('/')
  .get(adminController.getAdminSettings)
  .put(adminController.updateAdminSettings);

// Plan Settings Routes
router.route('/plans')
  .get(adminController.getPlanSettings)
  .put(adminController.updatePlanSettings);

// User Management Routes
router.route('/users')
  .get(adminController.getAllUsers);

router.route('/users/stats')
  .get(adminController.getDashboardStats);

router.route('/users/:id')
  .get(adminController.getUserById)
  .put(adminController.updateUser)
  .delete(adminController.deleteUser);

// User Settings Management Routes
router.route('/users/:userId')
  .get(adminController.getUserSettings);

router.route('/users/:userId/notifications')
  .put(adminController.updateNotificationSettings);

router.route('/users/:userId/language')
  .put(adminController.updateLanguageSettings);

router.route('/users/:userId/security')
  .put(adminController.updateSecuritySettings);

router.route('/users/:userId/privacy')
  .put(adminController.updateProfileVisibility);

router.route('/users/:userId/reset-password')
  .put(adminController.resetUserPassword);

router.route('/users/:userId/deactivate')
  .put(adminController.deactivateUserAccount);

router.route('/users/:userId/delete')
  .put(adminController.deleteUserAccount);

router.route('/users/:userId/reactivate')
  .put(adminController.reactivateUserAccount);

module.exports = router;