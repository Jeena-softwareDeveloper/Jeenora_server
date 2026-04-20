const dashboardController = require('../../controllers/wear/dashboardController') 
const aiAdminController = require('../../controllers/wear/aiAdminController')
const { authMiddleware } = require('../../middlewares/authMiddleware')
const router = require('express').Router()
  
router.get('/admin/get-dashboard-data',authMiddleware, dashboardController.get_admin_dashboard_data)  
router.get('/seller/get-dashboard-data',authMiddleware, dashboardController.get_seller_dashboard_data)      
router.post('/banner/add',authMiddleware, dashboardController.add_banner)  
router.put('/banner/update/:bannerId',authMiddleware, dashboardController.update_banner)
router.get('/banners', dashboardController.get_banners)

const aiMasterController = require('../../controllers/wear/aiMasterController')

// AI Admin Endpoints
router.post('/admin/ai/reviews', authMiddleware, aiMasterController.smart_review_summarize)
router.post('/admin/ai/support', authMiddleware, aiMasterController.auto_support_reply)
router.post('/admin/ai/fraud', authMiddleware, aiMasterController.fraud_assistant_scan)
router.post('/admin/ai/category-specs-suggest', authMiddleware, aiMasterController.suggest_category_specs)
router.post('/admin/ai/marketing-seo', authMiddleware, aiMasterController.meta_ads_generator)
router.get('/admin/ai/inventory-forecast', authMiddleware, aiMasterController.inventory_forecaster)
router.get('/admin/ai/logs', authMiddleware, aiMasterController.get_ai_logs) // AI Usage Dashboard

module.exports = router