const dashboardController = require('../../controllers/admin/dashboardController') 
const aiAdminController = require('../../controllers/admin/aiAdminController')
const { authMiddleware } = require('../../middlewares/authMiddleware')
const router = require('express').Router()
  
router.get('/admin/get-dashboard-data',authMiddleware, dashboardController.get_admin_dashboard_data)  
router.get('/admin-user/get-dashboard-data',authMiddleware, dashboardController.get_partner_dashboard_data)  
router.get('/partner/get-dashboard-data',authMiddleware, dashboardController.get_partner_dashboard_data)      
router.post('/banner/add',authMiddleware, dashboardController.add_banner)  
router.put('/banner/update/:bannerId',authMiddleware, dashboardController.update_banner)
router.get('/banners', dashboardController.get_banners)

const aiMasterController = require('../../controllers/admin/aiMasterController')

// AI Admin Endpoints
router.post('/admin/ai/reviews', authMiddleware, aiMasterController.smart_review_summarize)
router.post('/admin/ai/support', authMiddleware, aiMasterController.auto_support_reply)
router.post('/admin/ai/fraud', authMiddleware, aiMasterController.fraud_assistant_scan)
router.post('/admin/ai/category-specs-suggest', authMiddleware, aiMasterController.suggest_category_specs)
router.post('/admin/ai/marketing-seo', authMiddleware, aiMasterController.meta_ads_generator)
router.get('/admin/ai/inventory-forecast', authMiddleware, aiMasterController.inventory_forecaster)
router.get('/admin/ai/logs', authMiddleware, aiMasterController.get_ai_logs) // AI Usage Dashboard

// Supplier AI Endpoints
router.post('/supplier/ai-observe-image', authMiddleware, aiMasterController.ai_observe_image)
router.post('/supplier/ai-recommend', authMiddleware, aiMasterController.generate_ai_recommendation)
router.post('/supplier/ai-write-from-image', authMiddleware, aiMasterController.ai_write_from_image)
router.post('/supplier/ai-advise-price', authMiddleware, aiMasterController.advise_price)
router.post('/supplier/ai-seo-tags', authMiddleware, aiMasterController.generate_seo_tags)
router.post('/supplier/ai-suggest-gst', authMiddleware, aiMasterController.ai_suggest_gst)

// Supplier Catalog Routes (via dashboard path)
const wearCatalogController = require('../../controllers/partner/wearCatalogController');
router.get('/supplier/catalog/hsn-data', wearCatalogController.get_hsn_tax_data); // Public - no auth
router.patch('/supplier/catalog/status/:productId', authMiddleware, wearCatalogController.update_catalog_status);

module.exports = router
