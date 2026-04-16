const express = require('express');
const router = express.Router();
const supplierController = require('../../controllers/wear/supplierController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// Mobile and Dashboard Routes
router.post('/apply', authMiddleware, supplierController.apply_supplier);
router.post('/add', authMiddleware, supplierController.add_supplier);
router.get('/status', authMiddleware, supplierController.get_my_status);
router.post('/verify-bank', authMiddleware, supplierController.verify_bank);
router.post('/verify-ifsc', authMiddleware, supplierController.verify_ifsc);
router.post('/verify-pincode', authMiddleware, supplierController.verify_pincode);
router.post('/send-email-otp', authMiddleware, supplierController.send_verification_email);
router.post('/verify-email-otp', authMiddleware, supplierController.verify_email_otp);
router.post('/mark-congrats', authMiddleware, supplierController.mark_congrats_shown);

// Catalog Management (Meesho Flow)
const wearCatalogController = require('../../controllers/wear/wearCatalogController');
router.get('/catalog/list', wearCatalogController.get_public_catalogs); // Public
router.post('/catalog/add', authMiddleware, wearCatalogController.add_catalog);
router.get('/catalog/my-list', authMiddleware, wearCatalogController.get_my_catalogs);
router.get('/catalog/manual-list', authMiddleware, wearCatalogController.get_supplier_catalogs); // NEW: Dashboard specific list
router.put('/catalog/update/:productId', authMiddleware, wearCatalogController.update_catalog);
router.patch('/catalog/status/:productId', authMiddleware, wearCatalogController.update_catalog_status);
router.delete('/catalog/delete/:productId', authMiddleware, wearCatalogController.delete_catalog);

// Dashboard Admin Routes
router.get('/list', authMiddleware, supplierController.get_suppliers);
router.get('/catalog/all', authMiddleware, wearCatalogController.get_all_catalogs);
router.put('/update-status/:supplierId', authMiddleware, supplierController.update_status);
router.put('/update/:supplierId', authMiddleware, supplierController.update_supplier);
router.delete('/delete/:supplierId', authMiddleware, supplierController.delete_supplier);

module.exports = router;
