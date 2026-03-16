const router = require('express').Router();
const pesticideController = require('../../controllers/Awareness/PesticideController');
const { authMiddleware, adminMiddleware } = require('../../middlewares/authMiddleware');

// Public
router.get('/pesticides', pesticideController.get_pesticides);
router.get('/pesticides/:id', pesticideController.get_pesticide_detail);

// Admin
router.get('/admin/pesticides', authMiddleware, adminMiddleware, pesticideController.get_admin_pesticides);
router.post('/admin/pesticides/add', authMiddleware, adminMiddleware, pesticideController.add_pesticide);
router.put('/admin/pesticides/update/:id', authMiddleware, adminMiddleware, pesticideController.update_pesticide);
router.delete('/admin/pesticides/delete/:id', authMiddleware, adminMiddleware, pesticideController.delete_pesticide);
router.patch('/admin/pesticides/toggle-status/:id', authMiddleware, adminMiddleware, pesticideController.toggle_status);

module.exports = router;
