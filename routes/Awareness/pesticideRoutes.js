const router = require('express').Router();
const pesticideController = require('../../controllers/Awareness/PesticideController');
const { authMiddleware, sellerAdminMiddleware } = require('../../middlewares/authMiddleware');

// Public
router.get('/pesticides', pesticideController.get_pesticides);
router.get('/pesticides/:id', pesticideController.get_pesticide_detail);

// Management (Admin & Seller)
router.get('/admin/pesticides', authMiddleware, sellerAdminMiddleware, pesticideController.get_admin_pesticides);
router.post('/admin/pesticides/add', authMiddleware, sellerAdminMiddleware, pesticideController.add_pesticide);
router.put('/admin/pesticides/update/:id', authMiddleware, sellerAdminMiddleware, pesticideController.update_pesticide);
router.delete('/admin/pesticides/delete/:id', authMiddleware, sellerAdminMiddleware, pesticideController.delete_pesticide);
router.patch('/admin/pesticides/toggle-status/:id', authMiddleware, sellerAdminMiddleware, pesticideController.toggle_status);

module.exports = router;
