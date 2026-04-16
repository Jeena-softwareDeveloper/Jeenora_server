const router = require('express').Router();
const addressController = require('../../controllers/wear/addressController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', addressController.get_addresses);
router.post('/', addressController.add_address);
router.get('/:addressId', addressController.get_address_by_id);
router.put('/:addressId', addressController.update_address);
router.delete('/:addressId', addressController.delete_address);

module.exports = router;
