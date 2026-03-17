const AccountsController = require('../../controllers/Awareness/AccountController');
const router = require('express').Router();
const { authMiddleware, sellerAdminMiddleware } = require('../../middlewares/authMiddleware');

router.post('/accounts-add', authMiddleware, sellerAdminMiddleware, AccountsController.add_account);

router.get('/accounts', AccountsController.get_accounts);

router.get('/accounts/:id', AccountsController.get_account);

router.put('/accounts-update/:id', authMiddleware, sellerAdminMiddleware, AccountsController.update_account);

router.delete('/accounts-delete/:id', authMiddleware, sellerAdminMiddleware, AccountsController.delete_account);

router.patch('/accounts/toggle-status/:id', authMiddleware, sellerAdminMiddleware, AccountsController.toggle_status);
  
module.exports = router;