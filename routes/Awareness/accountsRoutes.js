const AccountsController = require('../../controllers/Awareness/AccountController');
const router = require('express').Router();
const { authMiddleware } = require('../../middlewares/authMiddleware');

// Add account
router.post('/accounts-add', AccountsController.add_account);

// Get all accounts
router.get('/accounts', AccountsController.get_accounts);

// Get single account
router.get('/accounts/:id', AccountsController.get_account);

// Update account
router.put('/accounts-update/:id', authMiddleware, AccountsController.update_account);

// Delete account
router.delete('/accounts-delete/:id', authMiddleware, AccountsController.delete_account);

// Toggle isActive
router.patch('/accounts/toggle-status/:id', authMiddleware, AccountsController.toggle_status);
  
module.exports = router;
